"use client";
/**
 * Tabla Rhythm Engine using Web Audio API.
 * Synthesises tabla/dhol-like percussive sounds via noise + resonant filter.
 * No audio files needed.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let reverbSend: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

/** Short synthetic room impulse (exponentially decaying noise) - adds acoustic space, not a plain drum-machine dry hit. */
function makeRoomImpulse(c: AudioContext): AudioBuffer {
  const durationS = 0.9;
  const length = Math.ceil(c.sampleRate * durationS);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 20;
    masterCompressor.ratio.value = 4;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.1;
    masterGain.connect(masterCompressor);
    masterCompressor.connect(ctx.destination);

    // Parallel wet reverb send gives strokes acoustic body instead of sounding dry/electronic.
    reverbNode = ctx.createConvolver();
    reverbNode.buffer = makeRoomImpulse(ctx);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.22;
    masterGain.connect(reverbSend);
    reverbSend.connect(reverbNode);
    reverbNode.connect(masterCompressor);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Small per-hit randomization so repeated strokes don't sound identical/mechanical. */
function humanize(volume: number): { volume: number; pitchOffset: number } {
  return {
    volume: volume * (0.92 + Math.random() * 0.16),
    pitchOffset: (Math.random() - 0.5) * 1.4,
  };
}

/** Clamp pitch so bass frequencies stay audible (≥ 30 Hz) */
function bassPitch(base: number, pitch: number, scale = 8): number {
  return Math.max(30, base + pitch * scale);
}

/**
 * Harmonic partial stack modeling the syahi-loaded membrane (Raman & Kumar, Nature 104:500, 1920):
 * the loading tunes the membrane's first ~5-6 modes to near-integer ratios of the fundamental,
 * so resonant strokes (Tin, Dha/Dhin dayan) are additive-synthesized rather than filtered noise.
 * Ratios below follow Raman's documented near-integer tuning (~1:2:3:4:4.8, the 5th mode
 * measured slightly sharp of a true 5th harmonic). Per-partial decay scaling is an engineering
 * heuristic (higher modes lose energy faster) - no published tabla-specific decay-rate table exists.
 */
function _playHarmonicMembrane(
  c: AudioContext,
  time: number,
  volume: number,
  fundamental: number,
  decaySeconds: number
) {
  const partials = [
    { ratio: 1, gain: 1, decayScale: 1 },
    { ratio: 2.01, gain: 0.45, decayScale: 0.55 },
    { ratio: 3.02, gain: 0.22, decayScale: 0.35 },
    { ratio: 4.03, gain: 0.12, decayScale: 0.22 },
    { ratio: 4.8, gain: 0.06, decayScale: 0.15 },
  ];

  // Comb-delay body resonance tuned to the fundamental period: reinforces the harmonic
  // series the way a coupled drum shell/body would, instead of partials ringing in isolation.
  const bodyDelay = c.createDelay(0.05);
  bodyDelay.delayTime.value = Math.min(0.05, 1 / fundamental);
  const bodyFeedback = c.createGain();
  bodyFeedback.gain.value = 0.32;
  const bodyMix = c.createGain();
  bodyMix.gain.value = volume * 0.5;
  bodyDelay.connect(bodyFeedback);
  bodyFeedback.connect(bodyDelay);
  bodyDelay.connect(bodyMix);
  bodyMix.connect(masterGain!);

  partials.forEach(({ ratio, gain, decayScale }) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = fundamental * ratio;
    const partialDecay = Math.max(0.05, decaySeconds * decayScale);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(volume * gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + partialDecay);
    osc.connect(g); g.connect(masterGain!); g.connect(bodyDelay);
    osc.start(time); osc.stop(time + partialDecay + 0.02);
  });

  setTimeout(() => {
    try { bodyDelay.disconnect(); bodyFeedback.disconnect(); bodyMix.disconnect(); } catch { /* already stopped */ }
  }, (decaySeconds + 0.5) * 1000);
}

/** Very short filtered-noise click giving the finger/palm contact "snap" under a resonant tone. */
function _playContactClick(c: AudioContext, time: number, volume: number, freq: number) {
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(volume, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.018);
  const src = _makeNoiseSrc(c, 0.02);
  src.connect(filter); filter.connect(g); g.connect(masterGain!);
  src.start(time);

  // Second, lower-band layer adds skin/rim texture rather than one thin click.
  const filter2 = c.createBiquadFilter();
  filter2.type = "bandpass";
  filter2.frequency.value = freq * 0.42;
  filter2.Q.value = 2;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, time);
  g2.gain.linearRampToValueAtTime(volume * 0.5, time + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  const src2 = _makeNoiseSrc(c, 0.035);
  src2.connect(filter2); filter2.connect(g2); g2.connect(masterGain!);
  src2.start(time);
}

// ── Percussion synthesis ─────────────────────────────────────────────────────

function playDha(time: number, volume: number, pitch: number) {
  const c = getCtx();
  const { volume: v, pitchOffset } = humanize(volume);

  // ── Bayan (left drum – low bass, palm-heel pitch bend) ──
  const bass = c.createOscillator();
  const bassGain = c.createGain();
  bass.type = "sine";
  bass.frequency.setValueAtTime(bassPitch(90, pitch + pitchOffset, 10), time);
  bass.frequency.exponentialRampToValueAtTime(bassPitch(45, pitch + pitchOffset, 5), time + 0.15);
  bassGain.gain.setValueAtTime(0, time);
  bassGain.gain.linearRampToValueAtTime(v * 0.9, time + 0.005);
  bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  bass.connect(bassGain); bassGain.connect(masterGain!);
  bass.start(time); bass.stop(time + 0.25);

  // ── Dayan (right drum – tuned syahi membrane ring) ──
  _playContactClick(c, time, v * 0.3, bassPitch(2200, pitch + pitchOffset, 30));
  _playHarmonicMembrane(c, time, v * 0.5, bassPitch(320, pitch + pitchOffset, 22), 0.3);
}

function playDhin(time: number, volume: number, pitch: number) {
  const c = getCtx();
  const { volume: v, pitchOffset } = humanize(volume);
  const bass = c.createOscillator();
  const bassGain = c.createGain();
  bass.type = "sine";
  bass.frequency.setValueAtTime(bassPitch(75, pitch + pitchOffset, 8), time);
  bass.frequency.exponentialRampToValueAtTime(bassPitch(38, pitch + pitchOffset, 4), time + 0.18);
  bassGain.gain.setValueAtTime(0, time);
  bassGain.gain.linearRampToValueAtTime(v * 0.75, time + 0.006);
  bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);
  bass.connect(bassGain); bassGain.connect(masterGain!);
  bass.start(time); bass.stop(time + 0.28);

  _playContactClick(c, time, v * 0.22, bassPitch(2000, pitch + pitchOffset, 26));
  _playHarmonicMembrane(c, time, v * 0.4, bassPitch(280, pitch + pitchOffset, 18), 0.35);
}

function playTin(time: number, volume: number, pitch: number) {
  const c = getCtx();
  const { volume: v, pitchOffset } = humanize(volume);
  _playContactClick(c, time, v * 0.3, bassPitch(2400, pitch + pitchOffset, 32));
  _playHarmonicMembrane(c, time, v * 0.55, bassPitch(420, pitch + pitchOffset, 30), 0.5);
}

function playTa(time: number, volume: number, pitch: number) {
  const c = getCtx();
  const { volume: v, pitchOffset } = humanize(volume);
  _playNoiseHit(c, time, v * 0.38, bassPitch(340, pitch + pitchOffset, 20), 7, 0.08);
}

function playNa(time: number, volume: number, pitch: number) {
  const c = getCtx();
  const { volume: v, pitchOffset } = humanize(volume);
  // High-frequency ghost note
  const hpFilter = c.createBiquadFilter();
  hpFilter.type = "highpass";
  hpFilter.frequency.value = bassPitch(700, pitch + pitchOffset, 40);
  hpFilter.Q.value = 2;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, time);
  ng.gain.linearRampToValueAtTime(v * 0.28, time + 0.003);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.065);
  const bufSrc = _makeNoiseSrc(c, 0.07);
  bufSrc.connect(hpFilter); hpFilter.connect(ng); ng.connect(masterGain!);
  bufSrc.start(time);
}

function playGe(time: number, volume: number, pitch: number) {
  // Low ghost stroke on bayan
  playDhin(time, volume * 0.45, pitch - 2);
}

function playKe(time: number, volume: number, pitch: number) {
  playNa(time, volume * 0.42, pitch);
}

/** Bandpass noise burst — shared helper */
function _playNoiseHit(
  c: AudioContext,
  time: number,
  volume: number,
  freq: number,
  Q: number,
  release: number
) {
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = Math.max(200, freq);
  filter.Q.value = Q;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, time);
  ng.gain.linearRampToValueAtTime(volume, time + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.001, time + release);
  const src = _makeNoiseSrc(c, release + 0.01);
  src.connect(filter); filter.connect(ng); ng.connect(masterGain!);
  src.start(time);
}

/** Create a short white-noise buffer source */
function _makeNoiseSrc(c: AudioContext, durationS: number): AudioBufferSourceNode {
  const bufLen = Math.ceil(c.sampleRate * durationS);
  const buffer = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

export function playSyllable(syllable: string, time: number, volume: number, pitch: number) {
  if (syllable === "-" || syllable.toLowerCase() === "rest") {
    return;
  }

  switch (syllable.toLowerCase()) {
    case "dha":  return playDha(time, volume, pitch);
    case "dhin": return playDhin(time, volume, pitch);
    case "tin":
    case "ti":   return playTin(time, volume, pitch);
    case "ta":   return playTa(time, volume, pitch);
    case "na":   return playNa(time, volume, pitch);
    case "ge":   return playGe(time, volume, pitch);
    case "ke":   return playKe(time, volume, pitch);
    default:     return playNa(time, volume, pitch);
  }
}

// ── Metronome click ──────────────────────────────────────────────────────────

export function playClick(time: number, volume: number, isAccent = false) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = isAccent ? 1200 : 800;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(volume * (isAccent ? 0.9 : 0.5), time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  osc.connect(g); g.connect(masterGain!);
  osc.start(time); osc.stop(time + 0.05);
}

// ── Scheduler ────────────────────────────────────────────────────────────────

interface SchedulerOptions {
  pattern: Array<{ syllable: string; isKhali: boolean }>;
  bpm: number;
  pitch: number;
  volume: number;
  isMetronome: boolean;
  onBeat: (beatIndex: number) => void;
}

const LOOKAHEAD_MS    = 25;
const SCHEDULE_AHEAD_S = 0.12;

let currentBeat  = 0;
let nextBeatTime = 0;
let schedulerOpts: SchedulerOptions | null = null;
const beatUiTimers = new Set<ReturnType<typeof setTimeout>>();

function scheduler() {
  if (!schedulerOpts) return;
  const { pattern, bpm, pitch, volume, isMetronome, onBeat } = schedulerOpts;
  const beatLen = 60 / bpm;
  const c = getCtx();

  while (nextBeatTime < c.currentTime + SCHEDULE_AHEAD_S) {
    const beatIdx = currentBeat % pattern.length;
    const beat    = pattern[beatIdx];

    if (isMetronome) {
      playClick(nextBeatTime, volume, beatIdx === 0);
    } else {
      // Khali beats play softer (no bass, ghost stroke only)
      playSyllable(beat.syllable, nextBeatTime, beat.isKhali ? volume * 0.3 : volume, pitch);
    }

    // Schedule UI callback as close to the beat as possible
    const delay = Math.max(0, (nextBeatTime - c.currentTime) * 1000);
    const capturedBeat = beatIdx;
    const uiTimer = setTimeout(() => {
      beatUiTimers.delete(uiTimer);
      if (schedulerOpts) onBeat(capturedBeat);
    }, delay);
    beatUiTimers.add(uiTimer);

    nextBeatTime += beatLen;
    currentBeat++;
  }

  schedulerTimer = setTimeout(scheduler, LOOKAHEAD_MS);
}

export function startRhythm(opts: SchedulerOptions) {
  stopRhythm();
  schedulerOpts = opts;
  currentBeat  = 0;
  nextBeatTime = getCtx().currentTime + 0.05;
  scheduler();
}

export function stopRhythm() {
  if (schedulerTimer) { clearTimeout(schedulerTimer); schedulerTimer = null; }
  beatUiTimers.forEach((timer) => clearTimeout(timer));
  beatUiTimers.clear();
  schedulerOpts = null;
  currentBeat  = 0;
}

export function updateBpm(bpm: number) {
  if (schedulerOpts) schedulerOpts = { ...schedulerOpts, bpm };
}

export function createTablaCaptureTap() {
  const audioContext = getCtx();
  const dest = audioContext.createMediaStreamDestination();
  masterGain?.connect(dest);

  return {
    stream: dest.stream,
    dispose: () => {
      try {
        masterGain?.disconnect(dest);
      } catch {
        // ignore disconnect errors when context graph changed
      }
    },
  };
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let recordingDest: MediaStreamAudioDestinationNode | null = null;

function clearAudioCapture() {
  if (!recordingDest) return;
  try { masterGain?.disconnect(recordingDest); } catch { /* ignore */ }
  recordingDest = null;
}

export async function startTablaAudioCapture(onError?: (message: string) => void): Promise<void> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Recording is not supported by this browser.");
  }
  if (mediaRecorder?.state === "recording") {
    throw new Error("A recording is already in progress.");
  }

  clearAudioCapture();
  const audioContext = getCtx();
  recordingDest = audioContext.createMediaStreamDestination();
  masterGain?.connect(recordingDest);
  recordedChunks = [];

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  try {
    mediaRecorder = new MediaRecorder(recordingDest.stream, { mimeType });
  } catch {
    clearAudioCapture();
    throw new Error("Recording could not be initialized in this browser.");
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onerror = () => {
    mediaRecorder = null;
    recordedChunks = [];
    clearAudioCapture();
    onError?.("Recording stopped unexpectedly. Please try again.");
  };
  mediaRecorder.start(100);
}

export async function stopTablaAudioCapture(): Promise<Blob | null> {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return null;

  return new Promise((resolve) => {
    mediaRecorder!.onstop = () => {
      const mimeType = mediaRecorder?.mimeType ?? "audio/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      recordedChunks = [];
      clearAudioCapture();
      mediaRecorder = null;
      resolve(blob);
    };
    try {
      mediaRecorder!.stop();
    } catch {
      resolve(null);
    }
  });
}

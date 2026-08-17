"use client";
/**
 * Tabla Rhythm Engine using cached recorded WAV samples and the Web Audio API.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

const BOL_SAMPLE_FILES: Record<string, string> = {
  dha: "/sounds/tabla/dha.wav",
  dhin: "/sounds/tabla/dhin.wav",
  din: "/sounds/tabla/dhin.wav",
  dhi: "/sounds/tabla/dhin.wav",
  tin: "/sounds/tabla/tin.wav",
  ti: "/sounds/tabla/tin.wav",
  na: "/sounds/tabla/na.wav",
  ta: "/sounds/tabla/na.wav",
  re: "/sounds/tabla/re.wav",
  ka: "/sounds/tabla/ka.wav",
  ke: "/sounds/tabla/ka.wav",
  ge: "/sounds/tabla/ka.wav",
  ki: "/sounds/tabla/kat.wav",
  tu: "/sounds/tabla/tun.wav",
  tun: "/sounds/tabla/tun.wav",
  kat: "/sounds/tabla/kat.wav",
};

const sampleCache = new Map<string, Promise<AudioBuffer>>();

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
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function loadSample(bol: string): Promise<AudioBuffer> {
  const cached = sampleCache.get(bol);
  if (cached) return cached;
  const path = BOL_SAMPLE_FILES[bol];
  if (!path) return Promise.reject(new Error(`No tabla sample mapped for ${bol}.`));

  const loading = fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load tabla sample: ${path}`);
      return response.arrayBuffer();
    })
    .then((data) => getCtx().decodeAudioData(data));
  sampleCache.set(bol, loading);
  return loading;
}

function playSample(bol: string, time: number, volume: number, pitch: number) {
  void loadSample(bol).then((buffer) => {
    const audioContext = getCtx();
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, pitch / 12);
    gainNode.gain.setValueAtTime(Math.max(0, volume), audioContext.currentTime);
    source.connect(gainNode);
    gainNode.connect(masterGain!);
    source.onended = () => {
      try { source.disconnect(); gainNode.disconnect(); } catch { /* already disconnected */ }
    };
    source.start(Math.max(time, audioContext.currentTime));
  }).catch((error) => {
    console.error(error);
  });
}

export function playSyllable(syllable: string, time: number, volume: number, pitch: number) {
  const bol = syllable.toLowerCase();
  if (bol === "-" || bol === "rest" || !BOL_SAMPLE_FILES[bol]) return;
  getCtx();
  playSample(bol, time, volume, pitch);
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

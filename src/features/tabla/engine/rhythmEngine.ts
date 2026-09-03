"use client";

/**
 * Tabla Rhythm Engine using Web Audio API.
 * High-precision scheduler (25ms lookahead, 100ms window) for zero-jitter rhythm loops.
 * Features:
 * - Real sample playback for acoustic bols (Dha, Dhin, Ge, Na, Tin, Ta, Tun, Kat, etc.)
 * - Parallel convolution reverb path & master dynamics compression
 * - Web Audio capture tap for studio-quality audio recording
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
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

const arrayBufferCache = new Map<string, Promise<ArrayBuffer>>();
const sampleCache = new Map<string, Promise<AudioBuffer>>();

function createReverbBuffer(audioCtx: AudioContext, duration = 1.8, decay = 2.2): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const percent = i / length;
    const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
    left[i] = val;
    right[i] = val * 0.92;
  }
  return impulse;
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    // Parallel Reverb Path
    try {
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = createReverbBuffer(ctx);
      reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.15; // default wet level
    } catch (e) {
      console.error("Tabla reverb creation failed:", e);
    }

    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 20;
    masterCompressor.ratio.value = 4;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.1;

    // Connect dry path
    masterGain.connect(masterCompressor);

    // Connect wet reverb path
    if (reverbNode && reverbGain) {
      masterGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(masterCompressor);
    }

    masterCompressor.connect(ctx.destination);

    void decodeAllCachedSamples();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function startPrefetching() {
  if (typeof window === "undefined") return;
  for (const [key, path] of Object.entries(BOL_SAMPLE_FILES)) {
    if (!arrayBufferCache.has(key)) {
      const promise = fetch(path)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load tabla sample: ${path}`);
          return res.arrayBuffer();
        })
        .catch((err) => {
          console.error(`Failed to prefetch tabla sample ${key}:`, err);
          arrayBufferCache.delete(key);
          throw err;
        });
      arrayBufferCache.set(key, promise);
    }
  }
}

async function decodeAllCachedSamples() {
  const audioContext = getCtx();
  for (const key of Object.keys(BOL_SAMPLE_FILES)) {
    if (!sampleCache.has(key)) {
      const decodePromise = (async () => {
        try {
          const bufferPromise = arrayBufferCache.get(key);
          let arrayBuffer: ArrayBuffer;
          if (bufferPromise) {
            arrayBuffer = await bufferPromise;
          } else {
            const path = BOL_SAMPLE_FILES[key];
            const res = await fetch(path);
            if (!res.ok) throw new Error(`Could not load tabla sample ${key}`);
            arrayBuffer = await res.arrayBuffer();
          }
          return await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (err) {
          console.error(`Failed to decode tabla sample ${key}:`, err);
          throw err;
        }
      })();
      sampleCache.set(key, decodePromise);
    }
  }
}

// Prefetch samples on module load
if (typeof window !== "undefined") {
  if (document.readyState === "complete") {
    startPrefetching();
  } else {
    window.addEventListener("load", startPrefetching);
  }

  const initAudioOnGesture = () => {
    try {
      getCtx();
      window.removeEventListener("pointerdown", initAudioOnGesture, true);
      window.removeEventListener("keydown", initAudioOnGesture, true);
    } catch {
      // ignore
    }
  };
  window.addEventListener("pointerdown", initAudioOnGesture, true);
  window.addEventListener("keydown", initAudioOnGesture, true);
}

function loadSample(bol: string): Promise<AudioBuffer> {
  const cached = sampleCache.get(bol);
  if (cached) return cached;

  const path = BOL_SAMPLE_FILES[bol];
  if (!path) return Promise.reject(new Error(`No tabla sample mapped for ${bol}.`));

  const audioContext = getCtx();
  const loading = (async () => {
    const bufferPromise = arrayBufferCache.get(bol);
    let arrayBuffer: ArrayBuffer;
    if (bufferPromise) {
      arrayBuffer = await bufferPromise;
    } else {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Could not load tabla sample: ${path}`);
      arrayBuffer = await res.arrayBuffer();
    }
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  })();

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
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {
        /* already disconnected */
      }
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
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(time);
  osc.stop(time + 0.05);
}

// ── Master Controls ─────────────────────────────────────────────────────────

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setReverbLevel(v: number) {
  if (reverbGain) {
    const audioContext = getCtx();
    reverbGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)) * 0.6, audioContext.currentTime);
  }
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

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

let currentBeat = 0;
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
    const beat = pattern[beatIdx];

    if (isMetronome) {
      playClick(nextBeatTime, volume, beatIdx === 0);
    } else {
      // Khali beats play softer (no bass, ghost stroke only)
      playSyllable(beat.syllable, nextBeatTime, beat.isKhali ? volume * 0.35 : volume, pitch);
    }

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
  currentBeat = 0;
  nextBeatTime = getCtx().currentTime + 0.05;
  scheduler();
}

export function stopRhythm() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  beatUiTimers.forEach((timer) => clearTimeout(timer));
  beatUiTimers.clear();
  schedulerOpts = null;
  currentBeat = 0;
}

export function updateBpm(bpm: number) {
  if (schedulerOpts) schedulerOpts = { ...schedulerOpts, bpm };
}

// ── Audio Recording Capture ────────────────────────────────────────────────

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
        /* ignore */
      }
    },
  };
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let recordingDest: MediaStreamAudioDestinationNode | null = null;

function clearAudioCapture() {
  if (!recordingDest) return;
  try {
    masterGain?.disconnect(recordingDest);
  } catch {
    /* ignore */
  }
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

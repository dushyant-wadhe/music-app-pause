"use client";

/**
 * World-Class Flute (Bansuri) Audio Engine using Web Audio API.
 * Features:
 * - Real sample playback with pitch-shifting across octaves 2-6
 * - Smooth sample looping for unlimited sustain
 * - Parallel convolution reverb for lush acoustic ambiance
 * - Master dynamics compressor & warmth filtering
 * - Breath onset attack & sustain-controlled exponential decay
 * - Equal & Just (Natural) Intonation tuning relative to RootNote (Sa)
 * - MediaStream audio capture for studio-quality recording
 */

import type { RootNote } from "@/types";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;

interface FluteVoice {
  source?: AudioBufferSourceNode;
  gainNode?: GainNode;
  filterNode?: BiquadFilterNode;
  stopped: boolean;
  sustain?: number;
  volume?: number;
  velocity?: number;
  startTime?: number;
}

const voices = new Map<string, FluteVoice[]>();

const SAMPLE_FILES: Record<string, { path: string; midi: number }> = {
  d2: { path: "/sounds/flute/d2.wav", midi: 38 },
  e2: { path: "/sounds/flute/e2.wav", midi: 40 },
  f2: { path: "/sounds/flute/f2.wav", midi: 41 },
  a:  { path: "/sounds/flute/a.wav",  midi: 57 },
  b:  { path: "/sounds/flute/b.wav",  midi: 59 },
  c:  { path: "/sounds/flute/c.wav",  midi: 60 },
  d:  { path: "/sounds/flute/d.wav",  midi: 62 },
  e:  { path: "/sounds/flute/e.wav",  midi: 64 },
  f:  { path: "/sounds/flute/f.wav",  midi: 65 },
  g:  { path: "/sounds/flute/g.wav",  midi: 67 },
};

const arrayBufferCache = new Map<string, Promise<ArrayBuffer>>();
const sampleCache = new Map<string, Promise<AudioBuffer>>();

const NOTE_TO_SEMITONE: Record<RootNote, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const JUST_RATIOS = [
  1,        // Sa (C)
  16 / 15,  // Re komal (C#)
  9 / 8,    // Re (D)
  6 / 5,    // Ga komal (D#)
  5 / 4,    // Ga (E)
  4 / 3,    // Ma (F)
  45 / 32,  // Ma tivra (F#)
  3 / 2,    // Pa (G)
  8 / 5,    // Dha komal (G#)
  5 / 3,    // Dha (A)
  9 / 5,    // Ni komal (A#)
  15 / 8,   // Ni (B)
];

function createReverbBuffer(audioCtx: AudioContext, duration = 2.2, decay = 2.4): AudioBuffer {
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
      reverbGain.gain.value = 0.2; // default wet level
    } catch (e) {
      console.error("Flute reverb creation failed:", e);
    }

    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -14;
    masterCompressor.knee.value = 10;
    masterCompressor.ratio.value = 3.5;
    masterCompressor.attack.value = 0.005;
    masterCompressor.release.value = 0.1;

    // Connect dry graph
    masterGain.connect(masterCompressor);

    // Connect wet reverb graph
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

function noteToFreq(
  note: string,
  transpose = 0,
  tuningMode: "equal" | "natural" = "equal",
  rootNote: RootNote = "C"
): number {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 261.63;

  const noteName = match[1] as RootNote;
  const semitones = NOTE_TO_SEMITONE[noteName] ?? 0;
  const octave = parseInt(match[2], 10);
  const midi = semitones + (octave + 1) * 12 + transpose;

  const equalFreq = 440 * Math.pow(2, (midi - 69) / 12);
  if (tuningMode === "equal") return equalFreq;

  const rootSemi = NOTE_TO_SEMITONE[rootNote];
  const rootMidi = (octave + 1) * 12 + rootSemi;
  const distance = midi - rootMidi;
  const octaveShift = Math.floor(distance / 12);
  const degree = ((distance % 12) + 12) % 12;
  const rootFreq = 440 * Math.pow(2, (rootMidi - 69) / 12) * Math.pow(2, octaveShift);
  const ratio = JUST_RATIOS[degree] ?? 1;

  return rootFreq * ratio;
}

function noteToMidi(note: string, transpose = 0): number {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 60;
  const semitones = NOTE_TO_SEMITONE[match[1] as RootNote] ?? 0;
  return semitones + (parseInt(match[2], 10) + 1) * 12 + transpose;
}

function selectSample(
  note: string,
  transpose = 0,
  tuningMode: "equal" | "natural" = "equal",
  rootNote: RootNote = "C"
): { key: string; playbackRate: number } | null {
  const targetMidi = noteToMidi(note, transpose);
  const keys = Object.keys(SAMPLE_FILES);
  if (keys.length === 0) return null;

  const sampleKey = keys.reduce((closest, key) =>
    Math.abs(SAMPLE_FILES[key].midi - targetMidi) < Math.abs(SAMPLE_FILES[closest].midi - targetMidi)
      ? key
      : closest
  );

  const sampleMidi = SAMPLE_FILES[sampleKey].midi;
  const sampleFreq = 440 * Math.pow(2, (sampleMidi - 69) / 12);
  const targetFreq = noteToFreq(note, transpose, tuningMode, rootNote);
  const playbackRate = targetFreq / sampleFreq;

  return { key: sampleKey, playbackRate };
}

function startPrefetching() {
  if (typeof window === "undefined") return;
  for (const [key, item] of Object.entries(SAMPLE_FILES)) {
    if (!arrayBufferCache.has(key)) {
      const promise = fetch(item.path)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load flute sample: ${item.path}`);
          return res.arrayBuffer();
        })
        .catch((err) => {
          console.error(`Failed to prefetch flute sample ${key}:`, err);
          arrayBufferCache.delete(key);
          throw err;
        });
      arrayBufferCache.set(key, promise);
    }
  }
}

async function decodeAllCachedSamples() {
  const audioContext = getCtx();
  for (const key of Object.keys(SAMPLE_FILES)) {
    if (!sampleCache.has(key)) {
      const decodePromise = (async () => {
        try {
          const bufferPromise = arrayBufferCache.get(key);
          let arrayBuffer: ArrayBuffer;
          if (bufferPromise) {
            arrayBuffer = await bufferPromise;
          } else {
            const item = SAMPLE_FILES[key];
            const res = await fetch(item.path);
            if (!res.ok) throw new Error(`Could not load flute sample ${key}`);
            arrayBuffer = await res.arrayBuffer();
          }
          return await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (err) {
          console.error(`Failed to decode flute sample ${key}:`, err);
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

function loadSample(sampleKey: string): Promise<AudioBuffer> {
  const cached = sampleCache.get(sampleKey);
  if (cached) return cached;

  const audioContext = getCtx();
  const loading = (async () => {
    const bufferPromise = arrayBufferCache.get(sampleKey);
    let arrayBuffer: ArrayBuffer;
    if (bufferPromise) {
      arrayBuffer = await bufferPromise;
    } else {
      const item = SAMPLE_FILES[sampleKey];
      if (!item) throw new Error(`No flute sample for ${sampleKey}`);
      const res = await fetch(item.path);
      if (!res.ok) throw new Error(`Could not load flute sample: ${item.path}`);
      arrayBuffer = await res.arrayBuffer();
    }
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  })();
  sampleCache.set(sampleKey, loading);
  return loading;
}

function startSampleVoice(
  voice: FluteVoice,
  sampleKey: string,
  playbackRate: number,
  volume: number,
  velocity: number
) {
  void loadSample(sampleKey)
    .then((buffer) => {
      if (voice.stopped) return;
      const audioCtx = getCtx();
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      const filterNode = audioCtx.createBiquadFilter();

      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      // Smart loop points for continuous sustain without cutting off
      if (buffer.duration > 2.0) {
        source.loop = true;
        source.loopStart = 0.6;
        source.loopEnd = buffer.duration - 0.3;
      } else if (buffer.duration > 1.0) {
        source.loop = true;
        source.loopStart = 0.3;
        source.loopEnd = buffer.duration - 0.15;
      } else {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }

      // Warm bamboo tone lowpass filtering
      filterNode.type = "lowpass";
      filterNode.frequency.value = Math.min(8000, 3200 + velocity * 2800);
      filterNode.Q.value = 1.2;

      // Envelope Attack (gentle breath onset ~35ms)
      const targetGain = Math.max(0, volume) * Math.max(0.15, Math.min(1, velocity));
      const attackTime = 0.035;

      const t = audioCtx.currentTime;
      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.linearRampToValueAtTime(targetGain, t + attackTime);

      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(masterGain!);

      voice.source = source;
      voice.gainNode = gainNode;
      voice.filterNode = filterNode;

      source.onended = () => {
        try {
          source.disconnect();
          filterNode.disconnect();
          gainNode.disconnect();
        } catch {
          /* ignore */
        }
      };
      source.start();
    })
    .catch((err) => {
      console.error("Flute playback start error:", err);
    });
}

function fadeAndStopVoice(voice: FluteVoice, fadeTime: number) {
  voice.stopped = true;
  if (!voice.gainNode || !voice.source) return;
  const audioCtx = getCtx();
  const t = audioCtx.currentTime;
  try {
    voice.gainNode.gain.cancelScheduledValues(t);
    const currentGain = Math.max(0.001, voice.gainNode.gain.value);
    voice.gainNode.gain.setValueAtTime(currentGain, t);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + fadeTime);

    const source = voice.source;
    const gainNode = voice.gainNode;
    const filterNode = voice.filterNode;

    setTimeout(() => {
      try {
        source.stop();
        source.disconnect();
        if (filterNode) filterNode.disconnect();
        gainNode.disconnect();
      } catch {
        /* already stopped */
      }
    }, fadeTime * 1000 + 50);
  } catch (err) {
    console.error("Error stopping flute voice:", err);
  }
}

export function playFluteNote(
  note: string,
  volume: number,
  sustain = 0.6,
  transpose = 0,
  rootNote: RootNote = "C",
  tuningMode: "equal" | "natural" = "equal",
  velocity = 1
) {
  const existing = voices.get(note);
  if (existing) {
    existing.forEach((v) => fadeAndStopVoice(v, 0.04));
  }

  getCtx();

  const selected = selectSample(note, transpose, tuningMode, rootNote);
  if (!selected) return;

  const voice: FluteVoice = {
    stopped: false,
    sustain,
    volume,
    velocity,
    startTime: Date.now(),
  };

  voices.set(note, [voice]);
  startSampleVoice(voice, selected.key, selected.playbackRate, volume, velocity);
}

export function stopFluteNote(note: string) {
  const activeVoices = voices.get(note);
  if (!activeVoices) return;
  voices.delete(note);

  activeVoices.forEach((voice) => {
    const sustainVal = voice.sustain ?? 0.6;
    const releaseTime = 0.08 + sustainVal * 1.2;
    fadeAndStopVoice(voice, releaseTime);
  });
}

export function stopAllFluteNotes() {
  for (const note of Array.from(voices.keys())) {
    stopFluteNote(note);
  }
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setReverbLevel(v: number) {
  if (reverbGain) {
    const audioCtx = getCtx();
    reverbGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)) * 0.75, audioCtx.currentTime);
  }
}

// ── Audio Recording Capture ────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let recordingDest: MediaStreamAudioDestinationNode | null = null;

function clearAudioCapture() {
  if (recordingDest) {
    try {
      masterGain?.disconnect(recordingDest);
    } catch {
      /* ignore */
    }
    recordingDest = null;
  }
}

export async function startAudioCapture(onError?: (message: string) => void): Promise<void> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Recording is not supported by this browser.");
  }
  if (mediaRecorder?.state === "recording") {
    throw new Error("A recording is already in progress.");
  }

  clearAudioCapture();

  const audioCtx = getCtx();
  recordingDest = audioCtx.createMediaStreamDestination();
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

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onerror = () => {
    mediaRecorder = null;
    recordedChunks = [];
    clearAudioCapture();
    onError?.("Recording stopped unexpectedly. Please try again.");
  };

  mediaRecorder.start(100);
}

export async function stopAudioCapture(): Promise<Blob | null> {
  if (!mediaRecorder) return null;
  if (mediaRecorder.state === "inactive") return null;

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

export function createFluteCaptureTap() {
  const audioCtx = getCtx();
  const dest = audioCtx.createMediaStreamDestination();
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

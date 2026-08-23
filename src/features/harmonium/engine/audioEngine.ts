"use client";
/**
 * Harmonium Audio Engine using Web Audio API.
 * Plays the recorded harmonium WAV samples through the Web Audio API.
 */

import type { DroneMode, HarmoniumToneMode, HarmoniumTuningMode, RootNote } from "@/types";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

interface SampleVoice {
  source?: AudioBufferSourceNode;
  gainNode?: GainNode;
  filterNode?: BiquadFilterNode;
  stopped: boolean;
  sustain?: number;
  volume?: number;
  velocity?: number;
  bellowsExpression?: number;
  startTime?: number;
}

const voices = new Map<string, SampleVoice[]>();
let droneVoices: SampleVoice[] = [];
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;

const SAMPLE_FILES = new Map<string, string>([
  "a2", "as2", "b2", "c2", "cs2", "d2", "ds2", "e2", "f2", "fs2", "g2", "gs2",
  "a3", "as3", "b3", "c3", "cs3", "d3", "ds3", "e3", "f3", "fs3", "g3", "gs3",
  "a4", "as4", "b4", "c4", "cs4", "d4", "ds4", "e4", "f4", "fs4", "g4", "gs4",
  "c5", "cs5", "d5",
].map((name) => [name, `/sounds/harmonium/${name}.wav`]));

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
  1,
  16 / 15,
  9 / 8,
  6 / 5,
  5 / 4,
  4 / 3,
  45 / 32,
  3 / 2,
  8 / 5,
  5 / 3,
  9 / 5,
  15 / 8,
];

function createReverbBuffer(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const percent = i / length;
    const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
    left[i] = val;
    right[i] = val * 0.95;
  }
  return impulse;
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;

    // Initialize parallel Reverb Convolver path
    try {
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = createReverbBuffer(ctx, 1.8, 2.0);
      reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.15; // default wet level
    } catch (e) {
      console.error("Convolver creation failed:", e);
    }

    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 12;
    masterCompressor.ratio.value = 4;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.08;

    // Connect dry path
    masterGain.connect(masterCompressor);

    // Connect wet reverb path
    if (reverbNode && reverbGain) {
      masterGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(masterCompressor);
    }

    masterCompressor.connect(ctx.destination);

    // Start background decoding of already prefetched buffers
    void decodeAllCachedSamples();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noteToFreq(
  note: string,
  transpose = 0,
  tuningMode: HarmoniumTuningMode = "equal",
  rootNote: RootNote = "C"
): number {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 261.63;
  const semitones = NOTE_TO_SEMITONE[match[1] as RootNote] ?? 0;
  const octave = parseInt(match[2]);
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

function sampleKeyToMidi(sampleKey: string): number {
  const match = sampleKey.match(/^([a-g])(s?)(\d)$/);
  if (!match) return 60;
  const noteName = `${match[1].toUpperCase()}${match[2] ? "#" : ""}` as RootNote;
  return NOTE_TO_SEMITONE[noteName] + (Number(match[3]) + 1) * 12;
}

function selectSample(
  note: string,
  transpose: number,
  tuningMode: HarmoniumTuningMode = "equal",
  rootNote: RootNote = "C"
): { key: string; playbackRate: number } | null {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  const targetMidi = NOTE_TO_SEMITONE[match[1] as RootNote] + (Number(match[2]) + 1) * 12 + transpose;
  
  const keys = Array.from(SAMPLE_FILES.keys());
  if (keys.length === 0) return null;

  const exactKey = keys.find((key) => sampleKeyToMidi(key) === targetMidi);
  const sampleKey = exactKey ?? keys.reduce((closest, key) =>
    Math.abs(sampleKeyToMidi(key) - targetMidi) < Math.abs(sampleKeyToMidi(closest) - targetMidi) ? key : closest
  );

  const sampleMidi = sampleKeyToMidi(sampleKey);
  const sampleFreq = 440 * Math.pow(2, (sampleMidi - 69) / 12);

  const targetFreq = noteToFreq(note, transpose, tuningMode, rootNote);
  const playbackRate = targetFreq / sampleFreq;

  return { key: sampleKey, playbackRate };
}

function startPrefetching() {
  if (typeof window === "undefined") return;
  for (const [key, path] of SAMPLE_FILES.entries()) {
    if (!arrayBufferCache.has(key)) {
      const promise = fetch(path)
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load harmonium sample: ${path}`);
          return response.arrayBuffer();
        })
        .catch((err) => {
          console.error(`Failed to prefetch sample ${key}:`, err);
          arrayBufferCache.delete(key);
          throw err;
        });
      arrayBufferCache.set(key, promise);
    }
  }
}

async function decodeAllCachedSamples() {
  const context = getCtx();
  for (const key of SAMPLE_FILES.keys()) {
    if (!sampleCache.has(key)) {
      const decodePromise = (async () => {
        try {
          const arrayBufferPromise = arrayBufferCache.get(key);
          let arrayBuffer: ArrayBuffer;
          if (arrayBufferPromise) {
            arrayBuffer = await arrayBufferPromise;
          } else {
            const path = SAMPLE_FILES.get(key)!;
            const res = await fetch(path);
            if (!res.ok) throw new Error(`Could not load sample: ${path}`);
            arrayBuffer = await res.arrayBuffer();
          }
          return await context.decodeAudioData(arrayBuffer.slice(0));
        } catch (err) {
          console.error(`Failed to decode sample ${key}:`, err);
          throw err;
        }
      })();
      sampleCache.set(key, decodePromise);
    }
  }
}

// Prefetch samples in background on module load (if in browser context)
if (typeof window !== "undefined") {
  if (document.readyState === "complete") {
    startPrefetching();
  } else {
    window.addEventListener("load", startPrefetching);
  }

  // Pre-initialize Context and trigger decoding on early user gesture to completely avoid keypress lag
  const initAudioOnGesture = () => {
    try {
      getCtx();
      window.removeEventListener("pointerdown", initAudioOnGesture, true);
      window.removeEventListener("keydown", initAudioOnGesture, true);
    } catch (e) {
      console.warn("Failed to initialize audio on user gesture:", e);
    }
  };
  window.addEventListener("pointerdown", initAudioOnGesture, true);
  window.addEventListener("keydown", initAudioOnGesture, true);
}

function loadSample(sampleKey: string): Promise<AudioBuffer> {
  const cached = sampleCache.get(sampleKey);
  if (cached) return cached;

  const context = getCtx();
  const loading = (async () => {
    const arrayBufferPromise = arrayBufferCache.get(sampleKey);
    let arrayBuffer: ArrayBuffer;
    if (arrayBufferPromise) {
      arrayBuffer = await arrayBufferPromise;
    } else {
      const path = SAMPLE_FILES.get(sampleKey);
      if (!path) throw new Error(`No harmonium sample for ${sampleKey}.`);
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Could not load harmonium sample: ${path}`);
      arrayBuffer = await response.arrayBuffer();
    }
    return await context.decodeAudioData(arrayBuffer.slice(0));
  })();
  sampleCache.set(sampleKey, loading);
  return loading;
}

function startSampleVoice(
  voice: SampleVoice,
  sampleKey: string,
  playbackRate: number,
  volume: number,
  velocity: number,
  toneMode: HarmoniumToneMode,
  bellowsExpression: number
) {
  void loadSample(sampleKey).then((buffer) => {
    if (voice.stopped) return;
    const ctx_ = getCtx();
    const source = ctx_.createBufferSource();
    const gainNode = ctx_.createGain();
    const filterNode = ctx_.createBiquadFilter();

    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    // Smooth looping skipping initial attack transients
    if (buffer.duration > 3) {
      source.loop = true;
      source.loopStart = 1.5;
      source.loopEnd = buffer.duration - 0.5;
    } else if (buffer.duration > 1.5) {
      source.loop = true;
      source.loopStart = 0.5;
      source.loopEnd = buffer.duration - 0.2;
    } else {
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
    }

    // Dynamic Tone filter
    filterNode.type = "lowpass";
    if (toneMode === "warm-reed") {
      filterNode.frequency.value = 2200 + bellowsExpression * 1800;
    } else {
      filterNode.frequency.value = 8000;
    }

    // Envelope Attack (based on expression/bellows pressure)
    const targetGain = Math.max(0, volume) * Math.max(0.2, Math.min(1, velocity)) * (0.3 + bellowsExpression * 0.7);
    const attackTime = 0.15 - bellowsExpression * 0.12;

    const t = ctx_.currentTime;
    gainNode.gain.setValueAtTime(0, t);
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
      } catch { /* already disconnected */ }
    };
    source.start();
  }).catch((error) => {
    console.error("Playback start error:", error);
  });
}

function fadeAndStopVoice(voice: SampleVoice, fadeTime: number) {
  voice.stopped = true;
  if (!voice.gainNode || !voice.source) return;
  const ctx_ = getCtx();
  const t = ctx_.currentTime;
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
      } catch { /* already stopped */ }
    }, (fadeTime * 1000) + 50);
  } catch (err) {
    console.error("Error stopping voice:", err);
  }
}

function shiftNoteOctave(note: string, octaveOffset: number): string {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return note;
  const oct = Number(match[2]);
  const newOct = Math.max(0, Math.min(8, oct + octaveOffset));
  return `${match[1]}${newOct}`;
}

export function playNote(
  note: string,
  volume: number,
  sustain: number,
  transpose = 0,
  rootNote: RootNote = "C",
  tuningMode: HarmoniumTuningMode = "equal",
  toneMode: HarmoniumToneMode = "basic",
  bellowsExpression = 0.7,
  velocity = 1,
  couplerEnabled = false,
  couplerBalance = 0.5
) {
  const existing = voices.get(note);
  if (existing) {
    existing.forEach((v) => fadeAndStopVoice(v, 0.05));
  }

  getCtx();

  const activeVoices: SampleVoice[] = [];

  // 1. Primary reed voice
  const selectedPrimary = selectSample(note, transpose, tuningMode, rootNote);
  if (selectedPrimary) {
    const primaryVol = volume * (1 - couplerBalance * 0.3);
    const voice: SampleVoice = {
      stopped: false,
      sustain,
      volume: primaryVol,
      velocity,
      bellowsExpression,
      startTime: Date.now(),
    };
    activeVoices.push(voice);
    startSampleVoice(voice, selectedPrimary.key, selectedPrimary.playbackRate, primaryVol, velocity, toneMode, bellowsExpression);
  }

  // 2. Coupler reed voice (one octave higher, offset by 15ms for acoustic linkage simulation)
  if (couplerEnabled) {
    const couplerNote = shiftNoteOctave(note, 1);
    const selectedCoupler = selectSample(couplerNote, transpose, tuningMode, rootNote);
    if (selectedCoupler) {
      const couplerVol = volume * (couplerBalance * 0.7);
      const voice: SampleVoice = {
        stopped: false,
        sustain,
        volume: couplerVol,
        velocity,
        bellowsExpression,
        startTime: Date.now(),
      };
      activeVoices.push(voice);
      setTimeout(() => {
        if (!voice.stopped) {
          startSampleVoice(voice, selectedCoupler.key, selectedCoupler.playbackRate, couplerVol, velocity, toneMode, bellowsExpression);
        }
      }, 15);
    }
  }

  voices.set(note, activeVoices);
}

export function stopNote(note: string) {
  const activeVoices = voices.get(note);
  if (!activeVoices) return;
  voices.delete(note);

  activeVoices.forEach((voice) => {
    const sustainVal = voice.sustain ?? 0.6;
    const releaseTime = 0.08 + sustainVal * 1.42;
    fadeAndStopVoice(voice, releaseTime);
  });
}

export function stopAllNotes() {
  for (const note of Array.from(voices.keys())) {
    stopNote(note);
  }
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = v;
}

export function setReverbLevel(v: number) {
  if (reverbGain) {
    const ctx_ = getCtx();
    reverbGain.gain.setValueAtTime(v * 0.8, ctx_.currentTime);
  }
}

// ── Drone ────────────────────────────────────────────────────────────────────

export function startDrone(
  mode: DroneMode,
  octave: number,
  volume: number,
  transpose = 0,
  rootNote: RootNote = "C",
  tuningMode: HarmoniumTuningMode = "equal",
  toneMode: HarmoniumToneMode = "basic",
  bellowsExpression = 0.7
) {
  stopDrone();
  if (mode === "off") return;

  const noteNames: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootSemi = NOTE_TO_SEMITONE[rootNote];
  const paSemi = (rootSemi + 7) % 12;

  const droneNotes: string[] = [];
  if (mode === "sa" || mode === "sa+pa") {
    droneNotes.push(`${noteNames[rootSemi]}${octave}`);
  }
  if (mode === "pa" || mode === "sa+pa") {
    droneNotes.push(`${noteNames[paSemi]}${octave}`);
  }

  const safeBellows = Math.max(0, Math.min(1, bellowsExpression));
  const targetVolume = volume * (0.22 + safeBellows * 0.18);

  droneNotes.forEach((note) => {
    const selected = selectSample(note, transpose, tuningMode, rootNote);
    if (!selected) return;

    const voice: SampleVoice = {
      stopped: false,
      sustain: 1.0,
      volume: targetVolume,
      velocity: 1.0,
      bellowsExpression,
      startTime: Date.now(),
    };
    droneVoices.push(voice);

    void loadSample(selected.key).then((buffer) => {
      if (voice.stopped) return;
      const ctx_ = getCtx();
      const source = ctx_.createBufferSource();
      const gainNode = ctx_.createGain();
      const filterNode = ctx_.createBiquadFilter();

      source.buffer = buffer;
      source.playbackRate.value = selected.playbackRate;

      source.loop = true;
      if (buffer.duration > 3) {
        source.loopStart = 1.5;
        source.loopEnd = buffer.duration - 0.5;
      } else {
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }

      filterNode.type = "lowpass";
      if (toneMode === "warm-reed") {
        filterNode.frequency.value = 1600 + safeBellows * 900;
      } else {
        filterNode.frequency.value = 5000;
      }

      const t = ctx_.currentTime;
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(targetVolume, t + 0.8);

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
        } catch { /* ignore */ }
      };
      source.start();
    }).catch(console.error);
  });
}

export function stopDrone() {
  droneVoices.forEach((v) => {
    fadeAndStopVoice(v, 0.5);
  });
  droneVoices = [];
}

export function createHarmoniumCaptureTap() {
  const ctx_ = getCtx();
  const dest = ctx_.createMediaStreamDestination();
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

// ── Recording capture ────────────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let recordingDest: MediaStreamAudioDestinationNode | null = null;

function clearAudioCapture() {
  if (recordingDest) {
    try { masterGain?.disconnect(recordingDest); } catch { /* ignore */ }
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

  // Disconnect previous destination to avoid accumulating connections
  clearAudioCapture();

  const ctx_ = getCtx();
  recordingDest = ctx_.createMediaStreamDestination();
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

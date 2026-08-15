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
  stopped: boolean;
}

interface DroneVoice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  osc3: OscillatorNode;
  vibratoLfo?: OscillatorNode;
  vibratoGain?: GainNode;
  breathSrc?: AudioBufferSourceNode;
  breathGain?: GainNode;
  waveShaper?: WaveShaperNode;
  inharmonicOsc?: OscillatorNode;
  inharmonicGain?: GainNode;
  transientOsc?: OscillatorNode;
  transientGain?: GainNode;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  filterNode2?: BiquadFilterNode;
}

const voices = new Map<string, SampleVoice>();
let droneVoices: DroneVoice[] = [];

const SAMPLE_FILES = new Map<string, string>([
  "a2", "as2", "b2", "c2", "cs2", "d2", "ds2", "e2", "f2", "fs2", "g2", "gs2",
  "a3", "as3", "b3", "c3", "cs3", "d3", "ds3", "e3", "f3", "fs3", "g3", "gs3",
  "a4", "as4", "b4", "c4", "cs4", "d4", "ds4", "e4", "f4", "fs4", "g4", "gs4",
  "c5", "cs5", "d5",
].map((name) => [name, `/sounds/harmonium/${name}.wav`]));

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

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -18;
    masterCompressor.knee.value = 24;
    masterCompressor.ratio.value = 3;
    masterCompressor.attack.value = 0.006;
    masterCompressor.release.value = 0.15;
    masterGain.connect(masterCompressor);
    masterCompressor.connect(ctx.destination);
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
  // e.g. "C4", "F#3"
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

function selectSample(note: string, transpose: number): { key: string; playbackRate: number } | null {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  const targetMidi = NOTE_TO_SEMITONE[match[1] as RootNote] + (Number(match[2]) + 1) * 12 + transpose;
  const exactKey = Array.from(SAMPLE_FILES.keys()).find((key) => sampleKeyToMidi(key) === targetMidi);
  const sampleKey = exactKey ?? Array.from(SAMPLE_FILES.keys()).reduce((closest, key) =>
    Math.abs(sampleKeyToMidi(key) - targetMidi) < Math.abs(sampleKeyToMidi(closest) - targetMidi) ? key : closest
  );
  return { key: sampleKey, playbackRate: Math.pow(2, (targetMidi - sampleKeyToMidi(sampleKey)) / 12) };
}

function loadSample(sampleKey: string): Promise<AudioBuffer> {
  const cached = sampleCache.get(sampleKey);
  if (cached) return cached;

  const path = SAMPLE_FILES.get(sampleKey);
  if (!path) return Promise.reject(new Error(`No harmonium sample for ${sampleKey}.`));
  const loading = fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load harmonium sample: ${path}`);
      return response.arrayBuffer();
    })
    .then((data) => getCtx().decodeAudioData(data));
  sampleCache.set(sampleKey, loading);
  return loading;
}

function startSampleVoice(
  voice: SampleVoice,
  sampleKey: string,
  playbackRate: number,
  volume: number,
  velocity: number
) {
  void loadSample(sampleKey).then((buffer) => {
    if (voice.stopped) return;
    const ctx_ = getCtx();
    const source = ctx_.createBufferSource();
    const gainNode = ctx_.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.setValueAtTime(Math.max(0, volume) * Math.max(0.2, Math.min(1, velocity)), ctx_.currentTime);
    source.connect(gainNode);
    gainNode.connect(masterGain!);
    voice.source = source;
    voice.gainNode = gainNode;
    source.onended = () => {
      try { source.disconnect(); gainNode.disconnect(); } catch { /* already disconnected */ }
    };
    source.start();
  }).catch((error) => {
    console.error(error);
  });
}


export function playNote(
  note: string,
  volume: number,
  _sustain: number,
  transpose = 0,
  rootNote: RootNote = "C",
  tuningMode: HarmoniumTuningMode = "equal",
  _toneMode: HarmoniumToneMode = "basic",
  _bellowsExpression = 0.7,
  velocity = 1
) {
  void _sustain;
  void _toneMode;
  void _bellowsExpression;
  void rootNote;
  void tuningMode;
  if (voices.has(note)) return; // already playing
  getCtx(); // create/resume the context inside the user input call stack
  const selected = selectSample(note, transpose);
  if (!selected) return;
  const voice: SampleVoice = { stopped: false };
  voices.set(note, voice);
  startSampleVoice(voice, selected.key, selected.playbackRate, volume, velocity);
}

export function stopNote(note: string) {
  const voice = voices.get(note);
  if (!voice) return;
  // Remove the voice immediately so a quick repeat of the same key can start a new sound.
  voices.delete(note);
  voice.stopped = true;
  if (!voice.gainNode || !voice.source) return;
  const ctx_ = getCtx();
  const t = ctx_.currentTime;
  voice.gainNode.gain.cancelScheduledValues(t);
  voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, t);
  // Short release keeps the instrument responsive and avoids notes hanging after input ends.
  voice.gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  setTimeout(() => {
    try {
      voice.source?.stop(); voice.source?.disconnect(); voice.gainNode?.disconnect();
    } catch { /* already stopped */ }
    if (voices.get(note) === voice) voices.delete(note);
  }, 150);
}

export function stopAllNotes() {
  for (const note of Array.from(voices.keys())) stopNote(note);
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = v;
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

  const rootSemi = NOTE_TO_SEMITONE[rootNote];
  const paSemi = (rootSemi + 7) % 12;
  const noteNames = Object.entries(NOTE_TO_SEMITONE).reduce<Record<number, RootNote>>((acc, [name, value]) => {
    acc[value] = name as RootNote;
    return acc;
  }, {});

  const dronePairs: string[] = [];
  if (mode === "sa" || mode === "sa+pa") dronePairs.push(`${noteNames[rootSemi]}${octave}`);
  if (mode === "pa" || mode === "sa+pa") dronePairs.push(`${noteNames[paSemi]}${octave}`);

  const safeBellows = Math.max(0, Math.min(1, bellowsExpression));

  droneVoices = dronePairs.map((note) => {
    const freq = noteToFreq(note, transpose, tuningMode, rootNote);
    const ctx_ = getCtx();
    const filter = ctx_.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = toneMode === "warm-reed" ? 900 + safeBellows * 700 : 1200 + safeBellows * 700;

    const gainNode = ctx_.createGain();
    gainNode.gain.setValueAtTime(0, ctx_.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * (0.28 + safeBellows * 0.2), ctx_.currentTime + 0.8);

    const osc1 = ctx_.createOscillator();
    osc1.type = toneMode === "warm-reed" ? "triangle" : "sawtooth";
    osc1.frequency.value = freq;

    const osc2 = ctx_.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.value = freq * (toneMode === "warm-reed" ? 0.999 : 0.998);

    const osc3 = ctx_.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = freq * 2;
    const subGain = ctx_.createGain();
    subGain.gain.value = 0.15;

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(subGain);
    subGain.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain!);

    osc1.start(); osc2.start(); osc3.start();
    return { osc1, osc2, osc3, gainNode, filterNode: filter };
  });
}

export function stopDrone() {
  droneVoices.forEach((v) => {
    const t = getCtx().currentTime;
    v.gainNode.gain.setValueAtTime(v.gainNode.gain.value, t);
    v.gainNode.gain.linearRampToValueAtTime(0.001, t + 0.5);
    setTimeout(() => {
      try {
        v.osc1.stop(); v.osc2.stop(); v.osc3.stop();
        v.osc1.disconnect(); v.osc2.disconnect(); v.osc3.disconnect();
        v.filterNode.disconnect(); v.gainNode.disconnect();
      } catch { /* already stopped */ }
    }, 550);
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

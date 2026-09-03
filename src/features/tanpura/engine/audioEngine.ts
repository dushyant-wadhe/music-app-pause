"use client";

import type { RootNote } from "@/types";

const TANPURA_SAMPLE = "/sounds/tanpura/tanpura-main.wav";
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

let ctx: AudioContext | null = null;
let samplePromise: Promise<AudioBuffer> | null = null;
let outputGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

let drone: {
  gainNode: GainNode;
  sources: AudioBufferSourceNode[];
  timers: ReturnType<typeof setTimeout>[];
  stopped: boolean;
} | null = null;

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let recordingDest: MediaStreamAudioDestinationNode | null = null;

function createReverbBuffer(audioCtx: AudioContext, duration = 2.5, decay = 2.6): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const percent = i / length;
    const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
    left[i] = val;
    right[i] = val * 0.94;
  }
  return impulse;
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    outputGain = ctx.createGain();
    outputGain.gain.value = 0.8;

    try {
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = createReverbBuffer(ctx);
      reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.2; // default wet level
    } catch (e) {
      console.error("Tanpura reverb creation failed:", e);
    }

    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 15;
    masterCompressor.ratio.value = 3.5;
    masterCompressor.attack.value = 0.005;
    masterCompressor.release.value = 0.1;

    // Connect dry path
    outputGain.connect(masterCompressor);

    // Connect wet reverb path
    if (reverbNode && reverbGain) {
      outputGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(masterCompressor);
    }

    masterCompressor.connect(ctx.destination);
  }

  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function loadSample(): Promise<AudioBuffer> {
  if (!samplePromise) {
    samplePromise = fetch(TANPURA_SAMPLE)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load tanpura sample: ${TANPURA_SAMPLE}`);
        return response.arrayBuffer();
      })
      .then((data) => getCtx().decodeAudioData(data))
      .catch((err) => {
        samplePromise = null;
        throw err;
      });
  }
  return samplePromise;
}

// Prefetch sample on load & user gesture
if (typeof window !== "undefined") {
  if (document.readyState === "complete") {
    void loadSample();
  } else {
    window.addEventListener("load", () => void loadSample());
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

function nearestZeroCrossing(buffer: AudioBuffer, center: number) {
  const data = buffer.getChannelData(0);
  const centerIndex = Math.floor(center * buffer.sampleRate);
  const radius = Math.floor(buffer.sampleRate * 0.08);
  let bestIndex = centerIndex;
  let bestValue = Number.POSITIVE_INFINITY;
  for (
    let index = Math.max(0, centerIndex - radius);
    index <= Math.min(data.length - 1, centerIndex + radius);
    index++
  ) {
    const value = Math.abs(data[index]);
    if (value < bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }
  return bestIndex / buffer.sampleRate;
}

function scheduleLoopSource(
  state: NonNullable<typeof drone>,
  buffer: AudioBuffer,
  offset: number,
  duration: number,
  startAt: number,
  playbackRate: number,
  fadeSeconds: number,
  loopStart: number,
  loopDuration: number
) {
  if (state.stopped) return;
  const audioContext = getCtx();
  const source = audioContext.createBufferSource();
  const sourceGain = audioContext.createGain();
  const endAt = startAt + duration / playbackRate;

  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  sourceGain.gain.setValueAtTime(0, startAt);
  sourceGain.gain.linearRampToValueAtTime(1, startAt + fadeSeconds);
  sourceGain.gain.setValueAtTime(1, Math.max(startAt + fadeSeconds, endAt - fadeSeconds));
  sourceGain.gain.linearRampToValueAtTime(0, endAt);

  source.connect(sourceGain);
  sourceGain.connect(state.gainNode);
  state.sources.push(source);

  source.onended = () => {
    try {
      source.disconnect();
      sourceGain.disconnect();
    } catch {
      /* already disconnected */
    }
    state.sources = state.sources.filter((active) => active !== source);
  };

  source.start(startAt, offset, duration);

  const nextStartAt = endAt - fadeSeconds;
  const scheduleNext = () =>
    scheduleLoopSource(
      state,
      buffer,
      loopStart,
      loopDuration,
      nextStartAt,
      playbackRate,
      fadeSeconds,
      loopStart,
      loopDuration
    );

  const delay = Math.max(0, (nextStartAt - audioContext.currentTime) * 1000 - 250);
  state.timers.push(setTimeout(scheduleNext, delay));
}

export function startTanpuraDrone(
  mode: "sa" | "pa" | "sa+pa",
  octave: number,
  volume: number,
  rootNote: RootNote,
  fineTune = 0
) {
  stopTanpuraDrone();
  const audioContext = getCtx();
  const gainNode = audioContext.createGain();

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(
    Math.max(0, Math.min(1, volume)),
    audioContext.currentTime + 0.1
  );
  gainNode.connect(outputGain!);

  const state = {
    gainNode,
    sources: [] as AudioBufferSourceNode[],
    timers: [] as ReturnType<typeof setTimeout>[],
    stopped: false,
  };
  drone = state;

  const pitchSemitones = NOTE_TO_SEMITONE[rootNote] + (octave - 3) * 12 + fineTune / 100;
  const baseRate = Math.pow(2, pitchSemitones / 12);

  void loadSample()
    .then((buffer) => {
      if (state.stopped) return;
      const loopStart = nearestZeroCrossing(buffer, 0.08);
      const loopEnd = nearestZeroCrossing(buffer, Math.max(0.25, buffer.duration - 0.08));
      const loopDuration = Math.max(0.15, loopEnd - loopStart);

      if (mode === "sa" || mode === "sa+pa") {
        scheduleLoopSource(
          state,
          buffer,
          0,
          loopEnd,
          audioContext.currentTime,
          baseRate,
          0.08,
          loopStart,
          loopDuration
        );
      }

      if (mode === "pa" || mode === "sa+pa") {
        const paRate = baseRate * Math.pow(2, 7 / 12);
        scheduleLoopSource(
          state,
          buffer,
          0,
          loopEnd,
          audioContext.currentTime,
          paRate,
          0.08,
          loopStart,
          loopDuration
        );
      }
    })
    .catch((error) => console.error(error));
}

export function stopTanpuraDrone() {
  const state = drone;
  drone = null;
  if (!state) return;

  state.stopped = true;
  state.timers.forEach((timer) => clearTimeout(timer));

  const audioContext = getCtx();
  state.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, audioContext.currentTime);
  state.gainNode.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);

  setTimeout(() => {
    state.sources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* already stopped */
      }
    });
    try {
      state.gainNode.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 120);
}

export function setMasterVolume(v: number) {
  if (outputGain) outputGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setReverbLevel(v: number) {
  if (reverbGain) {
    const audioContext = getCtx();
    reverbGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)) * 0.7, audioContext.currentTime);
  }
}

export function createTanpuraCaptureTap() {
  const audioContext = getCtx();
  const dest = audioContext.createMediaStreamDestination();
  outputGain?.connect(dest);
  return {
    stream: dest.stream,
    dispose: () => {
      try {
        outputGain?.disconnect(dest);
      } catch {
        /* ignore */
      }
    },
  };
}

function clearAudioCapture() {
  if (!recordingDest) return;
  try {
    outputGain?.disconnect(recordingDest);
  } catch {
    /* ignore */
  }
  recordingDest = null;
}

export async function startTanpuraAudioCapture(onError?: (message: string) => void) {
  if (typeof MediaRecorder === "undefined")
    throw new Error("Recording is not supported by this browser.");
  if (mediaRecorder?.state === "recording")
    throw new Error("A recording is already in progress.");
  if (!drone) throw new Error("Start the tanpura drone before recording.");

  clearAudioCapture();
  recordingDest = getCtx().createMediaStreamDestination();
  outputGain?.connect(recordingDest);
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

export async function stopTanpuraAudioCapture(): Promise<Blob | null> {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return null;

  return new Promise((resolve) => {
    mediaRecorder!.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType ?? "audio/webm" });
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

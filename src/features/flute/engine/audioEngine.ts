"use client";

const SAMPLE_MIDI: Record<string, number> = {
  d2: 38, e2: 40, f2: 41,
  a: 57, b: 59, c: 60, d: 62, e: 64, f: 65, g: 67,
};
const SAMPLE_PATHS = Object.fromEntries(Object.keys(SAMPLE_MIDI).map((key) => [key, `/sounds/flute/${key}.wav`]));
const cache = new Map<string, Promise<AudioBuffer>>();
interface FluteVoice { source?: AudioBufferSourceNode; gain?: GainNode; stopped: boolean; }
const voices = new Map<string, FluteVoice>();
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getCtx() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function midiForNote(note: string) {
  const match = note.match(/^([A-G])(#?)(\d)$/);
  if (!match) return null;
  const semitones: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  return semitones[`${match[1]}${match[2]}`] + (Number(match[3]) + 1) * 12;
}

function nearestSample(targetMidi: number) {
  return Object.keys(SAMPLE_MIDI).reduce((closest, key) =>
    Math.abs(SAMPLE_MIDI[key] - targetMidi) < Math.abs(SAMPLE_MIDI[closest] - targetMidi) ? key : closest
  );
}

function loadSample(key: string) {
  const cached = cache.get(key);
  if (cached) return cached;
  const loading = fetch(SAMPLE_PATHS[key])
    .then((response) => { if (!response.ok) throw new Error(`Could not load flute sample: ${SAMPLE_PATHS[key]}`); return response.arrayBuffer(); })
    .then((data) => getCtx().decodeAudioData(data));
  cache.set(key, loading);
  return loading;
}

export function playFluteNote(note: string, volume: number, velocity = 1) {
  if (voices.has(note)) return;
  const targetMidi = midiForNote(note);
  if (targetMidi === null) return;
  const sampleKey = nearestSample(targetMidi);
  const voice: FluteVoice = { stopped: false };
  voices.set(note, voice);
  getCtx();
  void loadSample(sampleKey).then((buffer) => {
    if (voice.stopped) return;
    const audioContext = getCtx();
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, (targetMidi - SAMPLE_MIDI[sampleKey]) / 12);
    gain.gain.setValueAtTime(Math.max(0, volume) * Math.max(0.2, Math.min(1, velocity)), audioContext.currentTime);
    source.connect(gain); gain.connect(masterGain!);
    voice.source = source; voice.gain = gain;
    source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch { /* already disconnected */ } };
    source.start();
  }).catch((error) => console.error(error));
}

export function stopFluteNote(note: string) {
  const voice = voices.get(note);
  if (!voice) return;
  voices.delete(note); voice.stopped = true;
  if (!voice.source || !voice.gain) return;
  const audioContext = getCtx();
  voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, audioContext.currentTime);
  voice.gain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + 0.08);
  setTimeout(() => { try { voice.source?.stop(); voice.source?.disconnect(); voice.gain?.disconnect(); } catch { /* already stopped */ } }, 100);
}

export function stopAllFluteNotes() { Array.from(voices.keys()).forEach(stopFluteNote); }

export function createFluteCaptureTap() {
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

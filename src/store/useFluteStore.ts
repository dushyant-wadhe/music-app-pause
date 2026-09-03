import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RootNote } from "@/types";

export interface RecordedFluteNote {
  note: string;
  durationMs: number;
}

interface FluteState {
  volume: number;
  octave: number;
  sustain: number;
  reverbLevel: number;
  transpose: number;
  rootNote: RootNote;
  isRecording: boolean;
  recordedNotes: RecordedFluteNote[];
  activeNotes: Set<string>;

  setVolume: (volume: number) => void;
  setOctave: (octave: number) => void;
  setSustain: (sustain: number) => void;
  setReverbLevel: (reverbLevel: number) => void;
  setTranspose: (transpose: number) => void;
  setRootNote: (rootNote: RootNote) => void;
  addActiveNote: (note: string) => void;
  removeActiveNote: (note: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  addRecordedNote: (note: string, durationMs: number) => void;
}

export const useFluteStore = create<FluteState>()(
  persist(
    (set) => ({
      volume: 0.8,
      octave: 4,
      sustain: 0.6,
      reverbLevel: 0.2,
      transpose: 0,
      rootNote: "C",
      isRecording: false,
      recordedNotes: [],
      activeNotes: new Set(),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setOctave: (octave) => set({ octave: Math.max(2, Math.min(6, octave)) }),
      setSustain: (sustain) => set({ sustain: Math.max(0, Math.min(1, sustain)) }),
      setReverbLevel: (reverbLevel) => set({ reverbLevel: Math.max(0, Math.min(1, reverbLevel)) }),
      setTranspose: (transpose) => set({ transpose: Math.max(-6, Math.min(6, transpose)) }),
      setRootNote: (rootNote) => set({ rootNote }),
      addActiveNote: (note) => set((state) => ({ activeNotes: new Set([...state.activeNotes, note]) })),
      removeActiveNote: (note) =>
        set((state) => {
          const activeNotes = new Set(state.activeNotes);
          activeNotes.delete(note);
          return { activeNotes };
        }),
      startRecording: () => set({ isRecording: true, recordedNotes: [] }),
      stopRecording: () => set({ isRecording: false }),
      addRecordedNote: (note, durationMs) =>
        set((state) => ({
          recordedNotes: [...state.recordedNotes, { note, durationMs }],
        })),
    }),
    {
      name: "flute-settings",
      partialize: (state) => ({
        volume: state.volume,
        octave: state.octave,
        sustain: state.sustain,
        reverbLevel: state.reverbLevel,
        transpose: state.transpose,
        rootNote: state.rootNote,
      }),
    }
  )
);

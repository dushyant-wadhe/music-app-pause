import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RootNote } from "@/types";

export type TanpuraDroneMode = "off" | "sa" | "pa" | "sa+pa";

interface TanpuraState {
  mode: TanpuraDroneMode;
  rootNote: RootNote;
  octave: number;
  volume: number;
  reverbLevel: number;
  fineTune: number;

  setMode: (mode: TanpuraDroneMode) => void;
  setRootNote: (note: RootNote) => void;
  setOctave: (octave: number) => void;
  setVolume: (volume: number) => void;
  setReverbLevel: (reverbLevel: number) => void;
  setFineTune: (fineTune: number) => void;
}

export const useTanpuraStore = create<TanpuraState>()(
  persist(
    (set) => ({
      mode: "off",
      rootNote: "C",
      octave: 3,
      volume: 0.7,
      reverbLevel: 0.2,
      fineTune: 0,

      setMode: (mode) => set({ mode }),
      setRootNote: (rootNote) => set({ rootNote }),
      setOctave: (octave) => set({ octave: Math.max(2, Math.min(5, octave)) }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setReverbLevel: (reverbLevel) => set({ reverbLevel: Math.max(0, Math.min(1, reverbLevel)) }),
      setFineTune: (fineTune) => set({ fineTune: Math.max(-50, Math.min(50, fineTune)) }),
    }),
    {
      name: "tanpura-settings",
      partialize: (state) => ({
        mode: state.mode,
        rootNote: state.rootNote,
        octave: state.octave,
        volume: state.volume,
        reverbLevel: state.reverbLevel,
        fineTune: state.fineTune,
      }),
    }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FluteState {
  volume: number;
  octave: number;
  activeNotes: Set<string>;
  setVolume: (volume: number) => void;
  setOctave: (octave: number) => void;
  addActiveNote: (note: string) => void;
  removeActiveNote: (note: string) => void;
}

export const useFluteStore = create<FluteState>()(
  persist(
    (set) => ({
      volume: 0.8,
      octave: 4,
      activeNotes: new Set(),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setOctave: (octave) => set({ octave: Math.max(2, Math.min(5, octave)) }),
      addActiveNote: (note) => set((state) => ({ activeNotes: new Set([...state.activeNotes, note]) })),
      removeActiveNote: (note) => set((state) => {
        const activeNotes = new Set(state.activeNotes);
        activeNotes.delete(note);
        return { activeNotes };
      }),
    }),
    { name: "flute-settings", partialize: (state) => ({ volume: state.volume, octave: state.octave }) }
  )
);

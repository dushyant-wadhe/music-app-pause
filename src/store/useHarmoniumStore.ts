import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DroneMode, HarmoniumSessionConfig, HarmoniumToneMode, HarmoniumTuningMode, RootNote } from "@/types";

interface HarmoniumState {
  volume: number;
  sustain: number;
  octave: number;
  transpose: number;
  drone: DroneMode;
  rootNote: RootNote;
  tuningMode: HarmoniumTuningMode;
  toneMode: HarmoniumToneMode;
  bellowsExpression: number;
  activeNotes: Set<string>;
  isRecording: boolean;
  recordedNotes: Array<{ note: string; time: number; duration: number }>;
  recordingStartTime: number | null;
  couplerEnabled: boolean;
  couplerBalance: number;
  reverbLevel: number;

  setVolume: (v: number) => void;
  setSustain: (v: number) => void;
  setOctave: (v: number) => void;
  setTranspose: (v: number) => void;
  setDrone: (d: DroneMode) => void;
  setRootNote: (note: RootNote) => void;
  setTuningMode: (mode: HarmoniumTuningMode) => void;
  setToneMode: (mode: HarmoniumToneMode) => void;
  setBellowsExpression: (value: number) => void;
  setCouplerEnabled: (enabled: boolean) => void;
  setCouplerBalance: (balance: number) => void;
  setReverbLevel: (level: number) => void;
  applyConfig: (config: HarmoniumSessionConfig) => void;
  addActiveNote: (note: string) => void;
  removeActiveNote: (note: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  addRecordedNote: (note: string, duration: number) => void;
  clearRecording: () => void;
}

export const useHarmoniumStore = create<HarmoniumState>()(
  persist(
    (set, get) => ({
      volume: 0.8,
      sustain: 0.6,
      octave: 4,
      transpose: 0,
      drone: "off",
      rootNote: "C",
      tuningMode: "equal",
      toneMode: "basic",
      bellowsExpression: 0.7,
      activeNotes: new Set(),
      isRecording: false,
      recordedNotes: [],
      recordingStartTime: null,
      couplerEnabled: false,
      couplerBalance: 0.5,
      reverbLevel: 0.15,

      setVolume: (v) => set({ volume: v }),
      setSustain: (v) => set({ sustain: v }),
      setOctave: (v) => set({ octave: v }),
      setTranspose: (v) => set({ transpose: v }),
      setDrone: (d) => set({ drone: d }),
      setRootNote: (note) => set({ rootNote: note }),
      setTuningMode: (mode) => set({ tuningMode: mode }),
      setToneMode: (mode) => set({ toneMode: mode }),
      setBellowsExpression: (value) => set({ bellowsExpression: Math.max(0, Math.min(1, value)) }),
      setCouplerEnabled: (enabled) => set({ couplerEnabled: enabled }),
      setCouplerBalance: (balance) => set({ couplerBalance: balance }),
      setReverbLevel: (level) => set({ reverbLevel: level }),
      applyConfig: (config) =>
        set({
          volume: config.volume,
          sustain: config.sustain,
          octave: config.octave,
          transpose: config.transpose,
          rootNote: config.rootNote ?? "C",
          tuningMode: config.tuningMode ?? "equal",
          toneMode: config.toneMode ?? "basic",
          bellowsExpression: config.bellowsExpression ?? 0.7,
          // Keep saved drone selection stable while editing session cards.
          drone: config.drone,
        }),

      addActiveNote: (note) =>
        set((s) => ({ activeNotes: new Set([...s.activeNotes, note]) })),
      removeActiveNote: (note) =>
        set((s) => {
          const next = new Set(s.activeNotes);
          next.delete(note);
          return { activeNotes: next };
        }),

      startRecording: () =>
        set({ isRecording: true, recordedNotes: [], recordingStartTime: Date.now() }),
      stopRecording: () =>
        set({ isRecording: false, recordingStartTime: null }),
      addRecordedNote: (note, duration) => {
        const start = get().recordingStartTime;
        if (!start) return;
        const time = Date.now() - start;
        set((s) => ({ recordedNotes: [...s.recordedNotes, { note, time, duration }] }));
      },
      clearRecording: () => set({ recordedNotes: [], recordingStartTime: null }),
    }),
    {
      name: "harmonium-settings",
      partialize: (s) => ({
        volume: s.volume,
        sustain: s.sustain,
        octave: s.octave,
        transpose: s.transpose,
        drone: s.drone,
        rootNote: s.rootNote,
        tuningMode: s.tuningMode,
        toneMode: s.toneMode,
        bellowsExpression: s.bellowsExpression,
        couplerEnabled: s.couplerEnabled,
        couplerBalance: s.couplerBalance,
        reverbLevel: s.reverbLevel,
      }),
    }
  )
);

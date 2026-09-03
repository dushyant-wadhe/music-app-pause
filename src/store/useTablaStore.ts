import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TablaPresetSlot, TablaSessionConfig, TaalName, ThaatName } from "@/types";
import { getCoreVariantsForTaal } from "@/features/tabla/data/taals";

interface TablaState {
  selectedTaal: TaalName;
  bpm: number;
  pitch: number;
  volume: number;
  reverbLevel: number;
  humanize: number;
  isPlaying: boolean;
  currentBeat: number;
  isLooping: boolean;
  mode: "tabla" | "metronome";
  countInBeats: 0 | 2 | 4 | 8;
  patternLayer: "core" | "style-pack";
  stylePackId: string | null;
  variantId: string;
  thaatContext: ThaatName | null;
  isCountingIn: boolean;
  countInRemaining: number;
  presetSlots: [TablaPresetSlot | null, TablaPresetSlot | null, TablaPresetSlot | null];
  favoriteTaals: TaalName[];
  isMetronomeMode: boolean;

  setTaal: (t: TaalName) => void;
  setBpm: (b: number) => void;
  setPitch: (p: number) => void;
  setVolume: (v: number) => void;
  setReverbLevel: (r: number) => void;
  setHumanize: (h: number) => void;
  setPlaying: (v: boolean) => void;
  setCurrentBeat: (b: number) => void;
  setMode: (mode: "tabla" | "metronome") => void;
  setCountInBeats: (beats: 0 | 2 | 4 | 8) => void;
  setPatternLayer: (layer: "core" | "style-pack") => void;
  setStylePackId: (stylePackId: string | null) => void;
  setVariantId: (variantId: string) => void;
  setThaatContext: (thaat: ThaatName | null) => void;
  setCountInState: (isCountingIn: boolean, countInRemaining: number) => void;
  savePresetSlot: (slotIndex: 0 | 1 | 2, name?: string) => void;
  loadPresetSlot: (slotIndex: 0 | 1 | 2) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  toggleFavorite: (t: TaalName) => void;
  applyConfig: (config: TablaSessionConfig) => void;
  reset: () => void;
}

export const useTablaStore = create<TablaState>()(
  persist(
    (set) => ({
      selectedTaal: "Teentaal",
      bpm: 80,
      pitch: 0,
      volume: 0.85,
      reverbLevel: 0.15,
      humanize: 0.02,
      isPlaying: false,
      currentBeat: 0,
      isLooping: true,
      mode: "tabla",
      countInBeats: 0,
      patternLayer: "core",
      stylePackId: null,
      variantId: "core-teentaal-basic",
      thaatContext: null,
      isCountingIn: false,
      countInRemaining: 0,
      presetSlots: [null, null, null],
      favoriteTaals: [],
      isMetronomeMode: false,

      setTaal: (t) =>
        set(() => {
          const firstVariant = getCoreVariantsForTaal(t)[0];
          return {
            selectedTaal: t,
            currentBeat: 0,
            isPlaying: false,
            patternLayer: "core" as const,
            stylePackId: null,
            variantId: firstVariant?.id ?? "",
          };
        }),
      setBpm: (b) => set({ bpm: Math.max(40, Math.min(240, b)) }),
      setPitch: (p) => set({ pitch: p }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setReverbLevel: (r) => set({ reverbLevel: Math.max(0, Math.min(1, r)) }),
      setHumanize: (h) => set({ humanize: Math.max(0, Math.min(0.1, h)) }),
      setPlaying: (v) => set({ isPlaying: v }),
      setCurrentBeat: (b) => set({ currentBeat: b }),
      setMode: (mode) => set({ mode, isMetronomeMode: mode === "metronome" }),
      setCountInBeats: (beats) => set({ countInBeats: beats }),
      setPatternLayer: (patternLayer) => set({ patternLayer }),
      setStylePackId: (stylePackId) => set({ stylePackId }),
      setVariantId: (variantId) => set({ variantId }),
      setThaatContext: (thaatContext) => set({ thaatContext }),
      setCountInState: (isCountingIn, countInRemaining) => set({ isCountingIn, countInRemaining }),
      savePresetSlot: (slotIndex, name) =>
        set((s) => {
          const nextSlots = [...s.presetSlots] as [TablaPresetSlot | null, TablaPresetSlot | null, TablaPresetSlot | null];
          nextSlots[slotIndex] = {
            name: name?.trim() || `Preset ${slotIndex + 1}`,
            taalName: s.selectedTaal,
            bpm: s.bpm,
            pitch: s.pitch,
            isLooping: s.isLooping,
            mode: s.mode,
            countInBeats: s.countInBeats,
            patternLayer: s.patternLayer,
            stylePackId: s.stylePackId,
            variantId: s.variantId,
            thaatContext: s.thaatContext,
          };
          return { presetSlots: nextSlots };
        }),
      loadPresetSlot: (slotIndex) =>
        set((s) => {
          const preset = s.presetSlots[slotIndex];
          if (!preset) return s;

          return {
            selectedTaal: preset.taalName,
            bpm: Math.max(40, Math.min(240, preset.bpm)),
            pitch: preset.pitch,
            isLooping: preset.isLooping,
            mode: preset.mode,
            isMetronomeMode: preset.mode === "metronome",
            countInBeats: preset.countInBeats,
            patternLayer: preset.patternLayer,
            stylePackId: preset.stylePackId,
            variantId: preset.variantId,
            thaatContext: preset.thaatContext,
            isPlaying: false,
            isCountingIn: false,
            countInRemaining: 0,
            currentBeat: 0,
          };
        }),
      toggleLoop: () => set((s) => ({ isLooping: !s.isLooping })),
      toggleMetronome: () =>
        set((s) => {
          const nextMode = s.mode === "metronome" ? "tabla" : "metronome";
          return { mode: nextMode, isMetronomeMode: nextMode === "metronome" };
        }),
      toggleFavorite: (t) =>
        set((s) => ({
          favoriteTaals: s.favoriteTaals.includes(t)
            ? s.favoriteTaals.filter((x) => x !== t)
            : [...s.favoriteTaals, t],
        })),
      applyConfig: (config) =>
        set({
          selectedTaal: config.taalName,
          bpm: Math.max(40, Math.min(240, config.bpm)),
          pitch: config.pitch,
          isLooping: config.isLooping,
          mode: config.mode ?? (config.isMetronomeMode ? "metronome" : "tabla"),
          countInBeats: config.countInBeats ?? 0,
          patternLayer: config.patternLayer ?? "core",
          stylePackId: config.stylePackId ?? null,
          variantId: config.variantId ?? `core-${config.taalName.toLowerCase()}-basic`,
          thaatContext: config.thaatContext ?? null,
          presetSlots: config.presetSlots ?? [null, null, null],
          isMetronomeMode: config.mode
            ? config.mode === "metronome"
            : config.isMetronomeMode,
          isCountingIn: false,
          countInRemaining: 0,
          isPlaying: false,
          currentBeat: 0,
        }),
      reset: () => set({ isPlaying: false, currentBeat: 0, isCountingIn: false, countInRemaining: 0 }),
    }),
    {
      name: "tabla-settings",
      partialize: (s) => ({
        selectedTaal: s.selectedTaal,
        bpm: s.bpm,
        pitch: s.pitch,
        isLooping: s.isLooping,
        mode: s.mode,
        countInBeats: s.countInBeats,
        patternLayer: s.patternLayer,
        stylePackId: s.stylePackId,
        variantId: s.variantId,
        thaatContext: s.thaatContext,
        presetSlots: s.presetSlots,
        favoriteTaals: s.favoriteTaals,
        isMetronomeMode: s.isMetronomeMode,
      }),
    }
  )
);

"use client";

import { useEffect } from "react";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useTablaStore } from "@/store/useTablaStore";
import { useTanpuraStore } from "@/store/useTanpuraStore";
import { resolveTablaVariant, TAALS } from "@/features/tabla/data/taals";
import { setMasterVolume, startDrone, stopDrone } from "@/features/harmonium/engine/audioEngine";
import { startRhythm, stopRhythm, updateBpm } from "@/features/tabla/engine/rhythmEngine";

export function PlaybackBridge() {
  const harmoniumVolume = useHarmoniumStore((state) => state.volume);
  const tanpuraMode = useTanpuraStore((state) => state.mode);
  const tanpuraRootNote = useTanpuraStore((state) => state.rootNote);
  const tanpuraOctave = useTanpuraStore((state) => state.octave);
  const tanpuraVolume = useTanpuraStore((state) => state.volume);

  const tablaSelectedTaal = useTablaStore((state) => state.selectedTaal);
  const tablaBpm = useTablaStore((state) => state.bpm);
  const tablaPitch = useTablaStore((state) => state.pitch);
  const tablaIsPlaying = useTablaStore((state) => state.isPlaying);
  const tablaIsMetronomeMode = useTablaStore((state) => state.isMetronomeMode);
  const tablaPatternLayer = useTablaStore((state) => state.patternLayer);
  const tablaStylePackId = useTablaStore((state) => state.stylePackId);
  const tablaVariantId = useTablaStore((state) => state.variantId);
  const libraryHasHydrated = useLibraryStore((state) => state.hasHydrated);
  const hydrateRecordingBlobUrls = useLibraryStore((state) => state.hydrateRecordingBlobUrls);

  useEffect(() => {
    setMasterVolume(harmoniumVolume);
  }, [harmoniumVolume]);

  useEffect(() => {
    if (tanpuraMode === "off") {
      stopDrone();
      return;
    }

    startDrone(
      tanpuraMode,
      tanpuraOctave,
      tanpuraVolume,
      0,
      tanpuraRootNote,
      "equal",
      "warm-reed",
      0.7
    );
    return () => stopDrone();
  }, [
    tanpuraMode,
    tanpuraOctave,
    tanpuraRootNote,
    tanpuraVolume,
  ]);

  useEffect(() => {
    if (!tablaIsPlaying) {
      stopRhythm();
      useTablaStore.getState().setCurrentBeat(0);
      return;
    }

    const taal = TAALS[tablaSelectedTaal];
    if (!taal) return;

    const resolved = resolveTablaVariant(
      tablaSelectedTaal,
      tablaPatternLayer,
      tablaVariantId,
      tablaStylePackId
    );

    const activePattern = resolved.variant?.pattern?.length
      ? resolved.variant.pattern
      : taal.pattern;

    startRhythm({
      pattern: activePattern.map((beat) => ({
        syllable: beat.syllable,
        isKhali: beat.isKhali,
      })),
      bpm: tablaBpm,
      pitch: tablaPitch,
      volume: 0.9,
      isMetronome: tablaIsMetronomeMode,
      onBeat: (beatIndex) => useTablaStore.getState().setCurrentBeat(beatIndex),
    });

    return () => stopRhythm();
  }, [
    tablaBpm,
    tablaIsMetronomeMode,
    tablaIsPlaying,
    tablaPatternLayer,
    tablaPitch,
    tablaSelectedTaal,
    tablaStylePackId,
    tablaVariantId,
  ]);

  useEffect(() => {
    if (tablaIsPlaying) {
      updateBpm(tablaBpm);
    }
  }, [tablaBpm, tablaIsPlaying]);

  useEffect(() => {
    if (!libraryHasHydrated) return;
    void hydrateRecordingBlobUrls();
  }, [hydrateRecordingBlobUrls, libraryHasHydrated]);

  return null;
}

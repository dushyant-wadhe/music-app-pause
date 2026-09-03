"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTablaStore } from "@/store/useTablaStore";
import { resolveTablaVariant, TAALS } from "../data/taals";
import { setMasterVolume, setReverbLevel } from "../engine/rhythmEngine";

export function useTablaEngine() {
  const {
    selectedTaal,
    bpm,
    volume,
    reverbLevel,
    countInBeats,
    patternLayer,
    stylePackId,
    variantId,
    isPlaying,
    setPlaying,
    setCurrentBeat,
    setCountInState,
  } = useTablaStore();

  const taal = TAALS[selectedTaal];
  const resolved = resolveTablaVariant(selectedTaal, patternLayer, variantId, stylePackId);
  const countInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync volume & reverb level to audio engine
  useEffect(() => {
    setMasterVolume(volume);
  }, [volume]);

  useEffect(() => {
    setReverbLevel(reverbLevel);
  }, [reverbLevel]);

  function clearCountInTimer() {
    if (!countInTimerRef.current) return;
    clearInterval(countInTimerRef.current);
    countInTimerRef.current = null;
  }

  const play = useCallback(() => {
    clearCountInTimer();
    setCurrentBeat(0);

    if (countInBeats === 0) {
      setCountInState(false, 0);
      setPlaying(true);
      return;
    }

    const intervalMs = Math.max(120, Math.round((60 / bpm) * 1000));
    let remaining = countInBeats;

    setPlaying(false);
    setCountInState(true, remaining);
    countInTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountInTimer();
        setCountInState(false, 0);
        setCurrentBeat(0);
        setPlaying(true);
        return;
      }
      setCountInState(true, remaining);
    }, intervalMs);
  }, [bpm, countInBeats, setCountInState, setCurrentBeat, setPlaying]);

  const pause = useCallback(() => {
    clearCountInTimer();
    setCountInState(false, 0);
    setPlaying(false);
  }, [setCountInState, setPlaying]);

  const stop = useCallback(() => {
    clearCountInTimer();
    setCountInState(false, 0);
    setPlaying(false);
    setCurrentBeat(0);
  }, [setCountInState, setCurrentBeat, setPlaying]);

  // Spacebar hotkey listener for Play/Pause toggle
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target) && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isPlaying, pause, play]);

  useEffect(() => () => clearCountInTimer(), []);

  return { play, pause, stop, taal, activeVariant: resolved.variant, activeStylePack: resolved.stylePack };
}

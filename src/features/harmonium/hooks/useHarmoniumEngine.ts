"use client";

import { useEffect, useRef, useCallback } from "react";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import {
  playNote,
  stopNote,
  stopAllNotes,
} from "../engine/audioEngine";
import { KEY_MAP } from "../data/keys";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;

export function useHarmoniumEngine() {
  const {
    volume,
    sustain,
    octave,
    transpose,
    rootNote,
    tuningMode,
    toneMode,
    bellowsExpression,
    addActiveNote,
    removeActiveNote,
    isRecording,
    addRecordedNote,
    couplerEnabled,
    couplerBalance,
  } = useHarmoniumStore();

  const activeSources     = useRef<Map<string, Set<string>>>(new Map());
  const noteStartTimes    = useRef<Map<string, number>>(new Map());
  const keyboardNoteMap   = useRef<Map<string, { note: string; source: string }>>(new Map());

  const panicStopAll = useCallback(() => {
    for (const note of activeSources.current.keys()) {
      removeActiveNote(note);
    }
    stopAllNotes();
    activeSources.current.clear();
    noteStartTimes.current.clear();
    keyboardNoteMap.current.clear();
  }, [removeActiveNote]);

  const handleNoteOn = useCallback((note: string, velocity = 1, source = "pointer") => {
    const sources = activeSources.current.get(note) ?? new Set<string>();
    if (sources.has(source)) return;

    const wasInactive = sources.size === 0;
    sources.add(source);
    activeSources.current.set(note, sources);
    if (!wasInactive) return;

    noteStartTimes.current.set(note, Date.now());
    playNote(note, volume, sustain, transpose, rootNote, tuningMode, toneMode, bellowsExpression, velocity, couplerEnabled, couplerBalance);
    addActiveNote(note);
  }, [addActiveNote, bellowsExpression, rootNote, sustain, toneMode, transpose, tuningMode, volume, couplerEnabled, couplerBalance]);

  const handleNoteOff = useCallback((note: string, source = "pointer") => {
    const sources = activeSources.current.get(note);
    if (!sources?.has(source)) return;

    sources.delete(source);
    if (sources.size > 0) return;

    activeSources.current.delete(note);
    stopNote(note);
    removeActiveNote(note);
    if (isRecording) {
      const start = noteStartTimes.current.get(note) ?? Date.now();
      addRecordedNote(note, Date.now() - start);
    }
    noteStartTimes.current.delete(note);
  }, [removeActiveNote, isRecording, addRecordedNote]);

  // Keyboard support
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target) || e.isComposing) return;
      const lowered = e.key.toLowerCase();
      if (keyboardNoteMap.current.has(lowered)) return;
      const semi = KEY_MAP[lowered];
      if (semi === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const noteOct      = semi >= 12 ? octave + 1 : octave;
      const semitoneInOct = semi % 12;
      const note = `${NOTE_NAMES[semitoneInOct]}${noteOct}`;
      const source = `keyboard:${e.code}`;
      keyboardNoteMap.current.set(lowered, { note, source });
      handleNoteOn(note, 1, source);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lowered = e.key.toLowerCase();
      const activeKey = keyboardNoteMap.current.get(lowered);
      if (!activeKey) return;
      e.preventDefault();
      e.stopPropagation();
      keyboardNoteMap.current.delete(lowered);
      handleNoteOff(activeKey.note, activeKey.source);
    };

    const onWindowBlur = () => {
      panicStopAll();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        panicStopAll();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      const source = `pointer:${event.pointerId}`;
      for (const [note, sources] of Array.from(activeSources.current.entries())) {
        if (sources.has(source)) handleNoteOff(note, source);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      panicStopAll();
    };
  }, [octave, handleNoteOn, handleNoteOff, panicStopAll]);

  useEffect(() => {
    if (!("requestMIDIAccess" in navigator)) return;

    let access: MIDIAccess | null = null;
    const listeners = new Map<MIDIInput, (event: MIDIMessageEvent) => void>();

    const midiToNote = (noteNumber: number) => {
      const semitone = noteNumber % 12;
      const noteOctave = Math.floor(noteNumber / 12) - 1;
      return `${NOTE_NAMES[semitone]}${noteOctave}`;
    };

    const detachListeners = () => {
      listeners.forEach((listener, input) => {
        input.removeEventListener("midimessage", listener);
      });
      listeners.clear();
    };

    const attachListeners = () => {
      if (!access) return;
      detachListeners();

      access.inputs.forEach((input) => {
        const listener = (event: MIDIMessageEvent) => {
          const data = event.data;
          if (!data || data.length < 3) return;

          const status = data[0] & 0xf0;
          const noteNumber = data[1];
          const velocity = data[2] / 127;
          const note = midiToNote(noteNumber);

          if (status === 0x90 && velocity > 0) {
            handleNoteOn(note, velocity, `midi:${input.id}:${noteNumber}`);
          } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
            handleNoteOff(note, `midi:${input.id}:${noteNumber}`);
          }
        };

        input.addEventListener("midimessage", listener);
        listeners.set(input, listener);
      });
    };

    navigator.requestMIDIAccess()
      .then((midiAccess) => {
        access = midiAccess;
        attachListeners();
        access.addEventListener("statechange", attachListeners);
      })
      .catch(() => {
        // Ignore MIDI init errors to keep keyboard interaction uninterrupted.
      });

    return () => {
      if (access) {
        access.removeEventListener("statechange", attachListeners);
      }
      detachListeners();
      panicStopAll();
    };
  }, [handleNoteOff, handleNoteOn, panicStopAll]);

  return { handleNoteOn, handleNoteOff };
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFluteStore } from "@/store/useFluteStore";
import {
  playFluteNote,
  stopFluteNote,
  stopAllFluteNotes,
  setReverbLevel,
} from "../engine/audioEngine";

const KEY_MAP: Record<string, number> = {
  a: 0,  // Sa  (C)
  s: 2,  // Re  (D)
  d: 4,  // Ga  (E)
  f: 5,  // Ma  (F)
  g: 7,  // Pa  (G)
  h: 9,  // Dha (A)
  j: 11, // Ni  (B)
  k: 12, // Sa' (C, next octave)
  w: 1,  // Re komal (C#)
  e: 3,  // Ga komal (D#)
  t: 6,  // Ma tivra (F#)
  y: 8,  // Dha komal (G#)
  u: 10, // Ni komal (A#)
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function useFluteEngine() {
  const {
    volume,
    sustain,
    octave,
    transpose,
    rootNote,
    reverbLevel,
    addActiveNote,
    removeActiveNote,
    isRecording,
    addRecordedNote,
  } = useFluteStore();

  const activeSources = useRef<Map<string, Set<string>>>(new Map());
  const noteStartTimes = useRef<Map<string, number>>(new Map());
  const keyboardNoteMap = useRef<Map<string, { note: string; source: string }>>(new Map());

  // Sync reverb level changes to engine
  useEffect(() => {
    setReverbLevel(reverbLevel);
  }, [reverbLevel]);

  const panicStopAll = useCallback(() => {
    for (const note of activeSources.current.keys()) {
      removeActiveNote(note);
    }
    stopAllFluteNotes();
    activeSources.current.clear();
    noteStartTimes.current.clear();
    keyboardNoteMap.current.clear();
  }, [removeActiveNote]);

  const noteOn = useCallback(
    (note: string, velocity = 1, source = "pointer") => {
      const sources = activeSources.current.get(note) ?? new Set<string>();
      if (sources.has(source)) return;

      const wasInactive = sources.size === 0;
      sources.add(source);
      activeSources.current.set(note, sources);

      if (!wasInactive) return;

      noteStartTimes.current.set(note, Date.now());
      playFluteNote(note, volume, sustain, transpose, rootNote, "equal", velocity);
      addActiveNote(note);
    },
    [addActiveNote, volume, sustain, transpose, rootNote]
  );

  const noteOff = useCallback(
    (note: string, source = "pointer") => {
      const sources = activeSources.current.get(note);
      if (!sources?.has(source)) return;

      sources.delete(source);
      if (sources.size > 0) return;

      activeSources.current.delete(note);
      stopFluteNote(note);
      removeActiveNote(note);

      if (isRecording) {
        const start = noteStartTimes.current.get(note) ?? Date.now();
        addRecordedNote(note, Date.now() - start);
      }
      noteStartTimes.current.delete(note);
    },
    [removeActiveNote, isRecording, addRecordedNote]
  );

  // Keyboard Event Listeners
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

      const offset = KEY_MAP[lowered];
      if (offset === undefined) return;

      e.preventDefault();
      e.stopPropagation();

      const noteOct = octave + (offset >= 12 ? 1 : 0);
      const semitone = offset % 12;
      const note = `${NOTE_NAMES[semitone]}${noteOct}`;
      const source = `keyboard:${e.code}`;

      keyboardNoteMap.current.set(lowered, { note, source });
      noteOn(note, 1, source);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const lowered = e.key.toLowerCase();
      const activeKey = keyboardNoteMap.current.get(lowered);
      if (!activeKey) return;

      e.preventDefault();
      e.stopPropagation();

      keyboardNoteMap.current.delete(lowered);
      noteOff(activeKey.note, activeKey.source);
    };

    const onWindowBlur = () => panicStopAll();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") panicStopAll();
    };

    const onPointerEnd = (event: PointerEvent) => {
      const source = `pointer:${event.pointerId}`;
      for (const [note, sources] of Array.from(activeSources.current.entries())) {
        if (sources.has(source)) noteOff(note, source);
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
  }, [octave, noteOn, noteOff, panicStopAll]);

  // Web MIDI Support
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
          const source = `midi:${input.id}:${noteNumber}`;

          if (status === 0x90 && velocity > 0) {
            noteOn(note, velocity, source);
          } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
            noteOff(note, source);
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
        // Ignore MIDI error
      });

    return () => {
      if (access) access.removeEventListener("statechange", attachListeners);
      detachListeners();
      panicStopAll();
    };
  }, [noteOff, noteOn, panicStopAll]);

  return { noteOn, noteOff, panicStopAll };
}

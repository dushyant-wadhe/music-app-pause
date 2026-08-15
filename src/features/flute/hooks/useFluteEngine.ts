"use client";

import { useCallback, useEffect, useRef } from "react";
import { playFluteNote, stopAllFluteNotes, stopFluteNote } from "../engine/audioEngine";
import { useFluteStore } from "@/store/useFluteStore";

const KEY_MAP: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function useFluteEngine() {
  const { volume, octave, addActiveNote, removeActiveNote } = useFluteStore();
  const sources = useRef(new Map<string, Set<string>>());
  const noteOn = useCallback((note: string, velocity = 1, source = "pointer") => {
    const active = sources.current.get(note) ?? new Set<string>();
    if (active.has(source)) return;
    const wasInactive = active.size === 0;
    active.add(source); sources.current.set(note, active);
    if (wasInactive) { playFluteNote(note, volume, velocity); addActiveNote(note); }
  }, [addActiveNote, volume]);
  const noteOff = useCallback((note: string, source = "pointer") => {
    const active = sources.current.get(note);
    if (!active?.has(source)) return;
    active.delete(source);
    if (active.size === 0) { sources.current.delete(note); stopFluteNote(note); removeActiveNote(note); }
  }, [removeActiveNote]);
  const stopAll = useCallback(() => { sources.current.clear(); stopAllFluteNotes(); useFluteStore.getState().activeNotes.forEach(removeActiveNote); }, [removeActiveNote]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const offset = KEY_MAP[event.key.toLowerCase()]; if (offset === undefined) return;
      event.preventDefault();
      noteOn(`${NAMES[offset % 12]}${octave + (offset >= 12 ? 1 : 0)}`, 1, `key:${event.code}`);
    };
    const onUp = (event: KeyboardEvent) => {
      const offset = KEY_MAP[event.key.toLowerCase()]; if (offset === undefined) return;
      event.preventDefault();
      noteOff(`${NAMES[offset % 12]}${octave + (offset >= 12 ? 1 : 0)}`, `key:${event.code}`);
    };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp); window.addEventListener("blur", stopAll);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", stopAll); };
  }, [noteOff, noteOn, octave, stopAll]);

  useEffect(() => {
    if (!("requestMIDIAccess" in navigator)) return;
    let access: MIDIAccess | null = null;
    const listeners = new Map<MIDIInput, (event: MIDIMessageEvent) => void>();
    const attach = () => {
      listeners.forEach((listener, input) => input.removeEventListener("midimessage", listener));
      listeners.clear();
      access?.inputs.forEach((input) => {
        const listener = (event: MIDIMessageEvent) => {
          const data = event.data; if (!data || data.length < 3) return;
          const status = data[0] & 0xf0; const midi = data[1]; const velocity = data[2] / 127;
          const note = `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
          const source = `midi:${input.id}:${midi}`;
          if (status === 0x90 && velocity > 0) noteOn(note, velocity, source);
          if (status === 0x80 || (status === 0x90 && velocity === 0)) noteOff(note, source);
        };
        input.addEventListener("midimessage", listener); listeners.set(input, listener);
      });
    };
    navigator.requestMIDIAccess().then((midiAccess) => { access = midiAccess; attach(); access.addEventListener("statechange", attach); }).catch(() => undefined);
    return () => { access?.removeEventListener("statechange", attach); listeners.forEach((listener, input) => input.removeEventListener("midimessage", listener)); };
  }, [noteOff, noteOn]);

  return { noteOn, noteOff };
}

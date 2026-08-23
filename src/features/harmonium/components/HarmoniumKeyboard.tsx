"use client";

import { useEffect, useRef, useState } from "react";
import { generateFull88Keys } from "../data/keys";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { cn } from "@/lib/cn";
import { sargamForNote } from "../utils/sargam";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { ActiveNoteDisplay } from "./ActiveNoteDisplay";
import type { HarmoniumKey, RootNote, HarmoniumToneMode, HarmoniumTuningMode } from "@/types";

interface KeyboardProps {
  onNoteOn: (note: string, velocity?: number, source?: string) => void;
  onNoteOff: (note: string, source?: string) => void;
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11
};

const WHITE_KEY_SHORTCUTS: Record<number, string> = {
  0: "A",
  2: "S",
  4: "D",
  5: "F",
  7: "G",
  9: "H",
  11: "J"
};

const BLACK_KEY_SHORTCUTS: Record<number, string> = {
  1: "W",
  3: "E",
  6: "T",
  8: "Y",
  10: "U"
};

function getAbsoluteSemitone(note: string): number {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 60;
  const name = match[1];
  const oct = Number(match[2]);
  return (NOTE_TO_SEMITONE[name] ?? 0) + (oct + 1) * 12;
}

export function HarmoniumKeyboard({ onNoteOn, onNoteOff }: KeyboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  const {
    volume, setVolume,
    sustain, setSustain,
    octave, setOctave,
    transpose, setTranspose,
    rootNote, setRootNote,
    tuningMode, setTuningMode,
    toneMode, setToneMode,
    bellowsExpression, setBellowsExpression,
    couplerEnabled, setCouplerEnabled,
    couplerBalance, setCouplerBalance,
    reverbLevel, setReverbLevel,
    activeNotes,
  } = useHarmoniumStore();

  const activePointers = useRef(new Set<number>());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const whiteKeyWidth = 45;
  const blackKeyWidth = 26;

  const keys = generateFull88Keys();
  const whites = keys.filter((k) => !k.isBlack);
  const blacks = keys.filter((k) => k.isBlack);

  const keyboardWidth = whites.length * whiteKeyWidth;

  const whiteIndexMap = new Map<string, number>();
  whites.forEach((k, i) => whiteIndexMap.set(k.note, i));

  const rootNotes: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const tuningOptions: HarmoniumTuningMode[] = ["equal", "natural"];
  const toneOptions: HarmoniumToneMode[] = ["basic", "warm-reed"];

  const saptaks = [
    { label: "s2", octave: 2 },
    { label: "s3", octave: 3 },
    { label: "s4", octave: 4 },
    { label: "s5", octave: 5 },
    { label: "s6", octave: 6 },
  ];

  function getBlackLeft(key: HarmoniumKey): number {
    const precedingSemis = new Map<number, number>([
      [1, 0],   // C# -> C
      [3, 2],   // D# -> D
      [6, 5],   // F# -> F
      [8, 7],   // G# -> G
      [10, 9]   // A# -> A
    ]);
    const targetSemi = precedingSemis.get(key.semitone);
    if (targetSemi === undefined) return 0;

    const precedingWhite = whites.find(w => w.octave === key.octave && w.semitone === targetSemi);
    if (!precedingWhite) return 0;

    const idx = whiteIndexMap.get(precedingWhite.note) ?? 0;
    return (idx + 1) * whiteKeyWidth - (blackKeyWidth / 2);
  }

  function enableScrollLock(pointerId: number) {
    activePointers.current.add(pointerId);
    document.body.classList.add("harmonium-scroll-lock");
    document.documentElement.classList.add("harmonium-scroll-lock");
  }

  // Refined gesture handlers to avoid click leaks
  function disableScrollLock(pointerId: number) {
    activePointers.current.delete(pointerId);
    if (activePointers.current.size > 0) return;
    document.body.classList.remove("harmonium-scroll-lock");
    document.documentElement.classList.remove("harmonium-scroll-lock");
  }

  function pointerHandlers(note: string) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        enableScrollLock(e.pointerId);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onNoteOn(note, 1, `pointer:${e.pointerId}`);
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        disableScrollLock(e.pointerId);
        onNoteOff(note, `pointer:${e.pointerId}`);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        e.preventDefault();
        disableScrollLock(e.pointerId);
        onNoteOff(note, `pointer:${e.pointerId}`);
      },
      onLostPointerCapture: (e: React.PointerEvent) => {
        disableScrollLock(e.pointerId);
        onNoteOff(note, `pointer:${e.pointerId}`);
      },
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onTouchStart: (e: React.TouchEvent) => e.preventDefault(),
      onTouchMove: (e: React.TouchEvent) => e.preventDefault(),
    };
  }

  useEffect(() => {
    const releaseScrollLock = () => {
      activePointers.current.clear();
      document.body.classList.remove("harmonium-scroll-lock");
      document.documentElement.classList.remove("harmonium-scroll-lock");
    };

    window.addEventListener("blur", releaseScrollLock);
    window.addEventListener("pointerup", releaseScrollLock);
    window.addEventListener("pointercancel", releaseScrollLock);

    return () => {
      window.removeEventListener("blur", releaseScrollLock);
      window.removeEventListener("pointerup", releaseScrollLock);
      window.removeEventListener("pointercancel", releaseScrollLock);
      releaseScrollLock();
    };
  }, []);

  // Smooth scroll target centering effect (only shifts if far from current selection)
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const idx = whites.findIndex((k) => k.note === `C${octave}`);
    if (idx !== -1) {
      const container = scrollContainerRef.current;
      const keyLeft = (idx + 4.5) * whiteKeyWidth;
      const containerWidth = container.clientWidth;
      const targetScrollLeft = keyLeft - (containerWidth / 2);

      const currentScrollLeft = container.scrollLeft;
      // Allow a buffer of 2.5 white keys to prevent scroll centering loops during manual swiping
      if (Math.abs(currentScrollLeft - targetScrollLeft) > whiteKeyWidth * 2.5) {
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: "smooth",
        });
      }
    }
  }, [octave, whites]);

  // Update store octave automatically based on manual scroll position
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    const maxScroll = container.scrollWidth - containerWidth;
    if (maxScroll > 0) {
      setScrollPercent((scrollLeft / maxScroll) * 100);
    }

    const centerOffset = scrollLeft + (containerWidth / 2);
    const centerKeyIdx = Math.floor(centerOffset / whiteKeyWidth);

    const centerKey = whites[centerKeyIdx];
    if (centerKey) {
      // Keep selected base octave bounded within the playable shortcut range [2, 6]
      const targetOctave = Math.max(2, Math.min(6, centerKey.octave));
      const currentStore = useHarmoniumStore.getState();
      if (targetOctave !== currentStore.octave) {
        currentStore.setOctave(targetOctave);
      }
    }
  };

  const handleScrollbarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const val = parseFloat(e.target.value);
    setScrollPercent(val);
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = (val / 100) * maxScroll;
  };

  const startMidi = getAbsoluteSemitone(`C${octave}`);
  const endMidi = startMidi + 12;

  const isMappedRange = (key: HarmoniumKey) => {
    const midi = getAbsoluteSemitone(key.note);
    return midi >= startMidi && midi <= endMidi;
  };

  return (
    <div
      className="harmonium-keybed relative w-full select-none touch-none overflow-hidden"
      aria-label="Harmonium keyboard"
      role="group"
    >
      <div
        className="relative flex"
        style={{ height: 120 }}
      >
        {/* White keys */}
        {whites.map((key) => {
          const active = activeNotes.has(key.note);
          return (
            <div
              key={key.note}
              className={cn(
                "piano-white-key touch-none flex-1 flex flex-col items-center justify-end pb-2",
                active && "active"
              )}
              style={{ height: 120 }}
              draggable={false}
              aria-label={`${sargamForNote(key.note, rootNote)} octave ${key.octave}`}
              {...pointerHandlers(key.note)}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold tracking-wide pointer-events-none",
                  active ? "text-[#92400e]" : "text-[#64748B]"
                )}
              >
                {sargamForNote(key.note, rootNote)}
              </span>
            </div>
          );
        })}

        {/* Black keys — absolutely positioned */}
        {blacks.map((key) => {
          const active = activeNotes.has(key.note);
          return (
            <div
              key={key.note}
              className={cn("piano-black-key", active && "active")}
              style={{
                left: blackLeft(key),
                width: `${whiteWidth * 0.58}%`,
                height: 72,
                top: 0,
              }}
              draggable={false}
              role="button"
              aria-hidden="true"
              aria-label={`${key.label} octave ${key.octave}`}
              {...pointerHandlers(key.note)}
            />
          );
        })}
      </div>
    </div>
  );
}

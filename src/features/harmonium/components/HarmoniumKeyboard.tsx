"use client";

import { useEffect, useRef, useState } from "react";
import { generateKeys } from "../data/keys";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { cn } from "@/lib/cn";
import { sargamForNote } from "../utils/sargam";

interface KeyboardProps {
  onNoteOn:  (note: string, velocity?: number, source?: string) => void;
  onNoteOff: (note: string, source?: string) => void;
}

export function HarmoniumKeyboard({ onNoteOn, onNoteOff }: KeyboardProps) {
  const { octave, activeNotes, rootNote } = useHarmoniumStore();
  const activePointers = useRef(new Set<number>());
  const [octaveCount, setOctaveCount] = useState(3);

  useEffect(() => {
    const setResponsiveOctaves = () => {
      setOctaveCount(window.innerWidth < 768 ? 2 : 3);
    };
    setResponsiveOctaves();
    window.addEventListener("resize", setResponsiveOctaves);
    return () => window.removeEventListener("resize", setResponsiveOctaves);
  }, []);
  // Always show 3 octaves centred around the selected octave
  const startOct = Math.max(1, octave - 1);
  const keys  = generateKeys(startOct, octaveCount);
  const whites = keys.filter((k) => !k.isBlack);
  const blacks = keys.filter((k) => k.isBlack);

  const whiteWidth = 100 / whites.length; // % width per white key

  // Map white key notes → their display index (for black key positioning)
  const whiteIndexMap = new Map<string, number>();
  whites.forEach((k, i) => whiteIndexMap.set(k.note, i));

  /**
   * Position a black key relative to its preceding white key.
   * Black keys sit 60% into the width of their preceding white key.
   */
  function blackLeft(key: typeof blacks[0]): string {
    // All whites that come before this black key (lower octave OR same octave with smaller semitone)
    const preceding = whites.filter((w) =>
      w.octave < key.octave ||
      (w.octave === key.octave && w.semitone < key.semitone)
    );
    const lastWhite = preceding[preceding.length - 1];
    const idx = lastWhite ? (whiteIndexMap.get(lastWhite.note) ?? 0) : 0;
    // Centre the black key over the boundary between lastWhite and next white
    return `${idx * whiteWidth + whiteWidth * 0.62}%`;
  }

  function enableScrollLock(pointerId: number) {
    activePointers.current.add(pointerId);
    document.body.classList.add("harmonium-scroll-lock");
    document.documentElement.classList.add("harmonium-scroll-lock");
  }

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

  return (
    <div
      className="relative w-full select-none touch-none overflow-hidden"
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
              role="button"
              aria-hidden="true"
              aria-label={`${sargamForNote(key.note, rootNote)} octave ${key.octave}`}
              {...pointerHandlers(key.note)}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold pointer-events-none",
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
                left:   blackLeft(key),
                width:  `${whiteWidth * 0.58}%`,
                height: 72,
                top:    0,
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

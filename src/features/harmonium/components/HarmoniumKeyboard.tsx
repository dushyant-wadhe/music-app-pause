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
  const isProgrammaticScrollRef = useRef(false);

  const whiteKeyWidth = 48;
  const blackKeyWidth = 28;

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

    if (isProgrammaticScrollRef.current) return;

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
    <div className="flex flex-col animate-in fade-in duration-200">
      <style>{`
        .harmonium-keybed-wrapper::-webkit-scrollbar {
          display: none;
        }
        .custom-slider-input::-webkit-slider-runnable-track {
          background: #251205;
          height: 4px;
          border-radius: 2px;
        }
        .custom-slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 32px;
          height: 18px;
          background: linear-gradient(180deg, #fcd34d 0%, #d97706 100%);
          border: 1px solid #b45309;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          cursor: pointer;
          margin-top: -7px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-slider-input::-webkit-slider-thumb::before {
          content: "◀ ▶";
          font-size: 7px;
          font-weight: bold;
          color: #5c3a21;
        }
      `}</style>

      {/* Unified Control Strip - Warm natural wood color */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center border-b border-[#2a1405] bg-gradient-to-r from-[#854d27] to-[#693c1d] px-4 py-1.5 shadow-md">

        {/* Left Side: Sa Selector & Saptak Quick-Jumps */}
        <div className="flex items-center gap-2.5 justify-self-start flex-wrap">
          <div className="flex items-center gap-1 bg-[#3d200d] px-2 py-0.5 rounded border border-[#2a1405] h-7">
            <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider">Sa</span>
            <select
              value={rootNote}
              onChange={(e) => setRootNote(e.target.value as RootNote)}
              className="h-6 rounded border-0 bg-transparent px-1 text-[10px] font-bold text-[#fdf6e2] focus:outline-none"
            >
              {rootNotes.map((note) => (
                <option key={note} value={note} className="bg-[#5c3a21] text-[#fdf6e2]">{note}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-0.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
            {saptaks.map((item) => (
              <button
                key={item.octave}
                onClick={() => {
                  isProgrammaticScrollRef.current = true;
                  setOctave(item.octave);
                  setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                  }, 600);
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center",
                  octave === item.octave
                    ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold"
                    : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Side: Wood-groove scrollbar slider - slimmed down */}
        <div className="flex items-center justify-center gap-2.5 justify-self-center w-full max-w-xs md:max-w-none">
          <span className="text-[7px] font-bold text-[#fcd34d]/75 uppercase tracking-widest pointer-events-none select-none">Low</span>
          <div className="relative flex-1 h-3 bg-[#1f140d] rounded-full border border-[#2a1405] flex items-center px-1 shadow-inner">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={scrollPercent}
              onChange={handleScrollbarChange}
              className="w-full h-1 bg-transparent appearance-none cursor-pointer focus:outline-none custom-slider-input"
            />
          </div>
          <span className="text-[7px] font-bold text-[#fcd34d]/75 uppercase tracking-widest pointer-events-none select-none">High</span>
        </div>

        {/* Right Side: ActiveNoteDisplay and Settings Gear */}
        <div className="flex items-center gap-3 justify-self-end flex-wrap">
          <div className="max-w-[70px] sm:max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
            <ActiveNoteDisplay />
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="text-[22px] text-[#fcd34d] hover:text-[#faf6f0] transition-colors cursor-pointer select-none leading-none"
            aria-label="Open advanced settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Keybed enclosure containing scrollable keys and fixed right coupler block */}
      <div className="flex bg-[#854d27] border-t border-[#2a1405] p-3 pr-0.5 gap-0.5 relative">
        {/* Scrollable keybed - Zero outer whitespace */}
        <div
          className="harmonium-keybed-wrapper relative flex-1 overflow-x-auto select-none touch-none pb-2"
          ref={scrollContainerRef}
          onScroll={handleScroll}
          aria-label="Harmonium keyboard scroll wrapper"
        >
          <div
            className="harmonium-keybed relative select-none"
            style={{ width: keyboardWidth, height: 145 }}
            aria-label="Harmonium keyboard"
            role="group"
          >
            <div className="relative flex h-full">
              {/* White keys */}
              {whites.map((key) => {
                const active = activeNotes.has(key.note);
                const isMapped = isMappedRange(key);

                let shortcut = "";
                if (isMapped) {
                  const midi = getAbsoluteSemitone(key.note);
                  if (midi === startMidi + 12) {
                    shortcut = "K";
                  } else {
                    const offset = midi - startMidi;
                    shortcut = WHITE_KEY_SHORTCUTS[offset] ?? "";
                  }
                }

                return (
                  <div
                    key={key.note}
                    className={cn(
                      "piano-white-key touch-none flex flex-col items-center justify-end pb-2 relative",
                      active && "active",
                      isMapped && "border-t-[3px] border-t-[#d97706]/80 bg-[#faf7f2]"
                    )}
                    style={{ width: whiteKeyWidth, height: 145 }}
                    draggable={false}
                    role="button"
                    aria-hidden="true"
                    aria-label={`${sargamForNote(key.note, rootNote)} octave ${key.octave}`}
                    {...pointerHandlers(key.note)}
                  >
                    {shortcut && (
                      <div className="absolute top-2 flex flex-col items-center pointer-events-none">
                        <span className="text-[9px] font-bold text-[#b45309] bg-[#fef3c7] px-1 py-0.5 rounded border border-[#f59e0b]/40 shadow-sm leading-none">
                          {shortcut}
                        </span>
                      </div>
                    )}
                    <span
                      className={cn(
                        "text-[8px] font-semibold tracking-wide pointer-events-none text-center w-full block",
                        active ? "text-[#92400e]" : "text-[#64748B]"
                      )}
                    >
                      {sargamForNote(key.note, rootNote)}
                      <span className="text-[7px] opacity-70 ml-0.5">s{key.octave}</span>
                    </span>
                  </div>
                );
              })}

              {/* Black keys — absolutely positioned */}
              {blacks.map((key) => {
                const active = activeNotes.has(key.note);
                const isMapped = isMappedRange(key);

                let shortcut = "";
                if (isMapped) {
                  const midi = getAbsoluteSemitone(key.note);
                  const offset = midi - startMidi;
                  shortcut = BLACK_KEY_SHORTCUTS[offset] ?? "";
                }

                return (
                  <div
                    key={key.note}
                    className={cn(
                      "piano-black-key absolute flex flex-col items-center justify-end pb-2.5",
                      active && "active",
                      isMapped && "border-t-[3px] border-t-[#f59e0b]/80"
                    )}
                    style={{
                      left: getBlackLeft(key),
                      width: blackKeyWidth,
                      height: 88,
                      top: 0,
                      zIndex: 10,
                    }}
                    draggable={false}
                    role="button"
                    aria-hidden="true"
                    aria-label={`${key.label} octave ${key.octave}`}
                    {...pointerHandlers(key.note)}
                  >
                    {shortcut && (
                      <span className="text-[8px] font-bold text-[#fef3c7] bg-[#78350f] px-1 py-0.5 rounded border border-[#d97706]/40 shadow-sm pointer-events-none leading-none">
                        {shortcut}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Minimal Fixed Right Coupler Stop Knob (No border/box) */}
        <div className="w-5 flex flex-col items-center justify-center shrink-0 select-none relative h-[145px]">
          {/* Vertical steel pull rod slot */}
          <div className="relative w-2.5 h-20 bg-[#140802] rounded-full border border-[#2a1405] flex flex-col items-center justify-center p-0.5 shadow-inner">
            {/* Guide line / track */}
            <div className="w-0.5 h-16 bg-black rounded" />

            {/* Sliding Metal Knob Shank and Cap */}
            <button
              onClick={() => setCouplerEnabled(!couplerEnabled)}
              className={cn(
                "absolute w-5.5 h-5.5 rounded-full bg-gradient-to-r from-[#e5e7eb] via-[#9ca3af] to-[#374151] border border-[#4b5563] shadow-md flex items-center justify-center cursor-pointer transition-all duration-200",
                couplerEnabled ? "translate-y-6.5 scale-105 shadow-lg border-[#d1d5db]" : "-translate-y-7"
              )}
              aria-label="Pull Coupler Register"
            >
              {/* Inner metallic cap core */}
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#d1d5db] to-[#4b5563] border border-[#374151] flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#fcd34d]" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Settings Drawer */}
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-45 bg-black/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-none opacity-0",
          showSettings && "pointer-events-auto opacity-100"
        )}
        onClick={() => setShowSettings(false)}
      />
      {/* Settings Drawer Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-[#faf6f0] border-l border-[#ead9c1] shadow-2xl p-5 flex flex-col gap-4 overflow-y-auto transition-transform duration-300 ease-in-out translate-x-full",
          showSettings && "translate-x-0"
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#ead9c1] pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b512b]">⚙ Advanced Settings</p>
          <button
            onClick={() => setShowSettings(false)}
            className="text-[10px] font-bold uppercase tracking-wider text-[#8c6239] hover:text-[#5c3a21] cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex flex-col gap-4">
          {/* Master Volume */}
          <Slider
            label="Master Volume"
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            onChange={(v) => setVolume(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          {/* Room Reverb */}
          <Slider
            label="Room Reverb"
            value={Math.round(reverbLevel * 100)}
            min={0}
            max={100}
            onChange={(v) => setReverbLevel(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          {/* Tuning Selector */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">Tuning</span>
            <div className="flex gap-1.5">
              {tuningOptions.map((mode) => (
                <Button
                  key={mode}
                  variant={tuningMode === mode ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setTuningMode(mode)}
                  className="text-[10px] h-7 px-2.5"
                >
                  {mode === "equal" ? "Equal" : "Natural"}
                </Button>
              ))}
            </div>
          </div>

          {/* Coupler Balance (Visible only when coupler is enabled) */}
          {couplerEnabled && (
            <div className="border-t border-[#ead9c1]/60 pt-3">
              <Slider
                label="Reed Balance (Primary / Octave)"
                value={Math.round(couplerBalance * 100)}
                min={0}
                max={100}
                onChange={(v) => setCouplerBalance(v / 100)}
                formatValue={(v) => {
                  if (v === 50) return "Balanced";
                  return v < 50 ? `${100 - v * 2}% Primary` : `${(v - 50) * 2}% Octave`;
                }}
              />
            </div>
          )}

          {/* Fine Sound Settings */}
          <div className="border-t border-[#ead9c1]/60 pt-3 flex flex-col gap-3.5">
            <Slider
              label="Sustain"
              value={Math.round(sustain * 100)}
              min={0}
              max={100}
              onChange={(v) => setSustain(v / 100)}
              formatValue={(v) => `${v}%`}
            />
            <Slider
              label="Transpose"
              value={transpose}
              min={-6}
              max={6}
              onChange={setTranspose}
              formatValue={(v) => (v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`)}
            />
            <Slider
              label="Bellows"
              value={Math.round(bellowsExpression * 100)}
              min={0}
              max={100}
              onChange={(v) => setBellowsExpression(v / 100)}
              formatValue={(v) => `${v}%`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">Reed Tone</span>
              <div className="flex gap-1.5">
                {toneOptions.map((mode) => (
                  <Button
                    key={mode}
                    variant={toneMode === mode ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setToneMode(mode)}
                    className="text-[10px] h-7 px-2.5"
                  >
                    {mode === "basic" ? "Basic" : "Warm Reed"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

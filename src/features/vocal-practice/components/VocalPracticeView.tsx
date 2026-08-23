"use client";

import { useState } from "react";
import { usePitchDetector } from "../hooks/usePitchDetector";
import { PitchGraph } from "./PitchGraph";
import { TargetNote } from "./TargetNote";
import { freqToMidi, sargamDegreeToMidi } from "../utils/sargamPitch";
import type { RootNote } from "@/types";

const ROOT_NOTES: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SAPTAKS = [
  { label: "s2", octave: 2 },
  { label: "s3", octave: 3 },
  { label: "s4", octave: 4 },
  { label: "s5", octave: 5 },
  { label: "s6", octave: 6 },
];

export function VocalPracticeView() {
  const [rootNote, setRootNote] = useState<RootNote>("C");
  const [octave, setOctave] = useState(4);
  const [targetDegree, setTargetDegree] = useState<number | null>(null);

  const { pitch, permission, startListening, stopListening } = usePitchDetector(rootNote);

  const isListening = pitch.isListening;

  // Derive live label — no effect needed, pure derivation
  const liveLabel = pitch.noteInfo
    ? { sargam: pitch.noteInfo.sargam, cents: pitch.cents, accuracy: pitch.accuracy }
    : null;

  // Match: within 30 cents of target (using smoothed frequency)
  const targetMidi = targetDegree !== null ? sargamDegreeToMidi(targetDegree, rootNote, octave) : null;
  const isMatching = targetMidi !== null && pitch.smoothedFrequency !== null &&
    Math.abs(freqToMidi(pitch.smoothedFrequency) - targetMidi) < 0.30;

  return (
    <div className="w-full flex flex-col gap-3">

      {/* ── Practice Console (Top Control Bar) ───────────────────────── */}
      <div
        className="rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4"
        style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)" }}
      >
        {/* Left section: Mic Power & Scale / Octave Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Title */}
          <span
            className="text-sm font-bold uppercase tracking-wider mr-1"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "1.2rem",
              color: "var(--accent-700)",
            }}
          >
            Swar Alap
          </span>

          {/* Mic Toggle Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={permission === "requesting" || permission === "unsupported"}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer h-7"
            style={{
              background: isListening
                ? "var(--app-fg)" // Deep charcoal when active
                : "var(--surface-soft)",
              color: isListening ? "#fffdf9" : "var(--ink-soft)",
              border: isListening ? "1.5px solid var(--app-fg)" : "1.5px solid var(--card-border)",
              boxShadow: isListening ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {isListening ? (
              <>
                <span
                  className="h-2 w-2 rounded-full inline-block"
                  style={{
                    background: "#5aa064",
                    boxShadow: "0 0 0 2.5px rgba(90,160,100,0.30)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                Mic is ON
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full inline-block bg-gray-400" />
                Mic is OFF
              </>
            )}
          </button>

          {/* Separator line */}
          <div className="hidden sm:block h-6 w-px" style={{ background: "var(--card-border)" }} />

          {/* Sa Selector */}
          <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
            Sa =
            <select
              value={rootNote}
              onChange={(e) => setRootNote(e.target.value as RootNote)}
              className="rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer h-7"
              style={{
                background: "var(--card-bg)",
                border: "1.5px solid var(--card-border)",
                color: "var(--app-fg)",
              }}
            >
              {ROOT_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          {/* Saptak Buttons Selector (referencing harmonium layout) */}
          <div className="flex items-center gap-0.5 bg-[var(--surface-muted)] p-0.5 rounded border border-[var(--card-border)] h-7">
            {SAPTAKS.map((item) => (
              <button
                key={item.octave}
                onClick={() => setOctave(item.octave)}
                className={`px-2.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center ${octave === item.octave
                    ? "bg-[var(--accent-700)] text-[#fffdf9] border-transparent font-extrabold"
                    : "bg-transparent text-[var(--ink-soft)] border-transparent hover:bg-[var(--surface-soft)]"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right section: Target Note Selector */}
        <div className="w-full lg:w-auto flex justify-start lg:justify-end">
          <TargetNote
            rootNote={rootNote}
            octave={octave}
            selectedDegree={targetDegree}
            onSelectDegree={setTargetDegree}
          />
        </div>
      </div>

      {/* ── Main Workspace ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Live Readout & Status Strip */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{
            background: isMatching ? "rgba(58,122,68,0.08)" : permission === "denied" ? "rgba(185,56,47,0.05)" : "var(--card-bg)",
            border: `1.5px solid ${isMatching ? "rgba(58,122,68,0.28)" : permission === "denied" ? "rgba(185,56,47,0.28)" : "var(--card-border)"}`,
            transition: "background 0.4s, border-color 0.4s",
            minHeight: "52px",
          }}
        >
          {permission === "denied" ? (
            <span className="text-xs font-semibold text-[#a73028]">
              ⚠️ Microphone access is blocked. Please allow mic in browser settings and reload.
            </span>
          ) : permission === "unsupported" ? (
            <span className="text-xs font-semibold text-[#a73028]">
              ⚠️ Browser microphone access is not supported.
            </span>
          ) : permission === "requesting" ? (
            <span className="text-xs font-semibold text-[var(--ink-soft)] flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full border-2 inline-block border-[var(--accent-700)] border-t-transparent animate-spin"
              />
              Requesting microphone access…
            </span>
          ) : (
            <div className="flex items-center gap-4">
              {/* Big note name */}
              <span
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: "2rem",
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                  color: isMatching ? "#3a7a44" : liveLabel ? "var(--app-fg)" : "var(--ink-soft)",
                  transition: "color 0.3s",
                  minWidth: "3.5rem",
                }}
              >
                {liveLabel?.sargam ?? "—"}
              </span>

              {liveLabel && (
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-xs font-semibold leading-none"
                    style={{
                      color: isMatching
                        ? "#3a7a44"
                        : liveLabel.accuracy === "flat"
                          ? "#5a7ab0"
                          : liveLabel.accuracy === "sharp"
                            ? "#b06820"
                            : "var(--ink-soft)",
                      transition: "color 0.3s",
                    }}
                  >
                    {isMatching
                      ? "✓ Swar matched"
                      : liveLabel.accuracy === "flat"
                        ? "▼ Flat"
                        : liveLabel.accuracy === "sharp"
                          ? "▲ Sharp"
                          : "≈ Approaching"}
                  </span>
                  <span
                    className="text-[10px] font-mono leading-none"
                    style={{ color: "var(--ink-soft)", opacity: 0.7 }}
                  >
                    {liveLabel.cents > 0 ? `+${liveLabel.cents}¢` : liveLabel.cents < 0 ? `${liveLabel.cents}¢` : "±0¢"}
                  </span>
                </div>
              )}
            </div>
          )}

          {isListening && pitch.frequency && (
            <span
              className="text-[11px] font-mono tabular-nums"
              style={{ color: "var(--ink-soft)", opacity: 0.5 }}
            >
              {pitch.frequency.toFixed(1)} Hz
            </span>
          )}
        </div>

        {/* ── Pitch Graph ─────────────────────────────────────────── */}
        <div
          className="w-full overflow-hidden rounded-2xl animate-fade-in"
          style={{
            height: "calc(100vh - 320px)",
            minHeight: "380px",
            maxHeight: "520px",
            border: "1px solid rgba(0,0,0,0.15)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <PitchGraph
            frequency={pitch.frequency}
            smoothedFrequency={pitch.smoothedFrequency}
            targetDegree={targetDegree}
            rootNote={rootNote}
            octave={octave}
            isListening={isListening}
          />
        </div>

      </div>
    </div>
  );
}

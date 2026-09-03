"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import {
  TanpuraRecordingControls,
  useTanpuraRecordingController,
} from "@/features/tanpura/components/TanpuraRecordingControls";
import { useTanpuraStore, type TanpuraDroneMode } from "@/store/useTanpuraStore";
import { cn } from "@/lib/cn";
import type { RootNote } from "@/types";

const ROOT_NOTES: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SAPTAKS = [
  { label: "s2", octave: 2 },
  { label: "s3", octave: 3 },
  { label: "s4", octave: 4 },
  { label: "s5", octave: 5 },
];

export function TanpuraView() {
  const recordingController = useTanpuraRecordingController();
  const [showSettings, setShowSettings] = useState(false);

  const {
    mode, setMode,
    rootNote, setRootNote,
    octave, setOctave,
    volume, setVolume,
    reverbLevel, setReverbLevel,
    fineTune, setFineTune,
  } = useTanpuraStore();

  const isPlaying = mode !== "off";

  return (
    <div className="tanpura-workspace mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-3 md:py-5 relative">
      
      {/* ── Outer Header Controls Bar (Matching Harmonium Reference) ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">
            Riyaaz instrument
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">
            Tanpura
          </h1>
        </div>

        {recordingController.isRecording ? (
          <Button variant="danger" size="sm" onClick={recordingController.handleStop}>
            <span className="h-2 w-2 rounded-full bg-[#fecaca] animate-pulse" />
            Stop recording
          </Button>
        ) : (
          <Button
            variant="surface"
            size="sm"
            onClick={recordingController.handleStart}
            disabled={recordingController.isStarting || Boolean(recordingController.blobUrl) || !isPlaying}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            {recordingController.isStarting ? "Starting..." : "Record"}
          </Button>
        )}
      </div>

      {/* ── Main Performance Cabinet Enclosure ── */}
      <Card glow={isPlaying} className="tanpura-performance overflow-hidden border border-[#d7b58d] rounded-xl shadow-lg p-0">
        
        {/* Top Control Bar (Root Sa, Saptak, Gear icon) */}
        <div className="flex items-center justify-between gap-2 border-b border-[#2a1405] bg-gradient-to-r from-[#854d27] to-[#693c1d] px-3.5 py-2 text-[#fdf6e2] shadow-md">
          
          {/* Left: Root Sa & Saptak Quick Jumps */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#3d200d] px-2 py-0.5 rounded border border-[#2a1405]">
              <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider">Root Sa</span>
              <select
                value={rootNote}
                onChange={(event) => setRootNote(event.target.value as RootNote)}
                className="h-6 rounded border-0 bg-transparent px-0.5 text-[11px] font-bold text-[#fdf6e2] focus:outline-none cursor-pointer"
                aria-label="Choose Root Sa note"
              >
                {ROOT_NOTES.map((note) => (
                  <option key={note} value={note} className="bg-[#5c3a21] text-[#fdf6e2]">
                    {note}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
              {SAPTAKS.map((item) => (
                <button
                  key={item.octave}
                  onClick={() => setOctave(item.octave)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center",
                    octave === item.octave
                      ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                      : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Gear Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="text-lg text-[#fcd34d] hover:text-[#faf6f0] transition-colors cursor-pointer select-none leading-none px-1"
            aria-label="Open advanced settings"
          >
            ⚙
          </button>
        </div>

        {/* Performance Body */}
        <div className="p-3 flex flex-col items-center justify-center gap-2 text-center">

          {/* Floating Readout Badge */}
          <div className="flex items-center justify-center gap-2 px-1 flex-wrap">
            <span className="font-serif text-lg font-bold text-[#2f2119]">
              Tanpura Drone
            </span>
            <span className="text-[10px] font-bold text-[#8a5a2b] bg-[#f4e5cf] px-2.5 py-0.5 rounded-full border border-[#cfa675] shadow-xs">
              {isPlaying
                ? `Drone Active · ${mode.toUpperCase()} · ${rootNote}${octave}`
                : "Drone at rest"}
            </span>
          </div>

          {/* Tanpura Stage Visualizer */}
          <section className="tanpura-stage !min-h-[260px] md:!min-h-[300px] w-full" aria-label="Tanpura drone instrument">
            <div className={cn("tanpura-instrument scale-90 sm:scale-100", isPlaying && "is-playing")} aria-hidden="true">
              <div className="tanpura-neck">
                <span className="tanpura-peg peg-one" />
                <span className="tanpura-peg peg-two" />
                <span className="tanpura-peg peg-three" />
                <span className="tanpura-peg peg-four" />
              </div>
              <div className="tanpura-body">
                <span className="tanpura-rosette" />
                <span className="tanpura-bridge" />
                <div className="tanpura-strings">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <p className="tanpura-stage-caption text-[9px] mt-1">
              {isPlaying ? `Sustaining ${rootNote}${octave} drone` : "Select a mode below to start"}
            </p>
          </section>

          {/* Single-Line Mode Switcher & Volume Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-lg bg-[#fbf6ef] px-3 py-2 rounded-lg border border-[#e3d7c2] mt-1">
            {/* Mode Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#75685b] mr-1">
                Mode
              </span>
              {(["off", "sa", "pa", "sa+pa"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setMode(option as TanpuraDroneMode)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer",
                    mode === option
                      ? "bg-[#8a5a2b] text-[#fffdfa] border-[#74451f] shadow-sm"
                      : "bg-[#fffaf3] text-[#55473d] border-[#dfd1bd] hover:bg-[#f4e5cf]"
                  )}
                >
                  {option === "off" ? "Off" : option === "sa" ? "Sa" : option === "pa" ? "Pa" : "Sa + Pa"}
                </button>
              ))}
            </div>

            {/* Inline Compact Volume Control */}
            <div className="flex items-center gap-2 min-w-[140px] flex-1 justify-end">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#75685b]">
                Vol
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-20 sm:w-28 h-1 accent-[#9b6524] cursor-pointer"
                aria-label="Adjust volume"
              />
              <span className="text-[10px] font-mono text-[#8a5a2b] font-bold w-8 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

        </div>
      </Card>

      {/* ── Saved Recordings Section ── */}
      <TanpuraRecordingControls controller={recordingController} />

      {/* ── Slide-over Settings Drawer ── */}
      <div
        className={cn(
          "fixed inset-0 z-45 bg-black/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-none opacity-0",
          showSettings && "pointer-events-auto opacity-100"
        )}
        onClick={() => setShowSettings(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-[#faf6f0] border-l border-[#ead9c1] shadow-2xl p-5 flex flex-col gap-4 overflow-y-auto transition-transform duration-300 ease-in-out translate-x-full",
          showSettings && "translate-x-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-[#ead9c1] pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b512b]">
            ⚙ Advanced Tanpura Settings
          </p>
          <button
            onClick={() => setShowSettings(false)}
            className="text-[10px] font-bold uppercase tracking-wider text-[#8c6239] hover:text-[#5c3a21] cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Slider
            label="Master Volume"
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            onChange={(v) => setVolume(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          <Slider
            label="Room Reverb"
            value={Math.round(reverbLevel * 100)}
            min={0}
            max={100}
            onChange={(v) => setReverbLevel(v / 100)}
            formatValue={(v) => `${v}%`}
          />

          <Slider
            label="Fine Pitch Tuning"
            value={fineTune}
            min={-50}
            max={50}
            onChange={setFineTune}
            formatValue={(v) => (v === 0 ? "0 cents" : v > 0 ? `+${v} cents` : `${v} cents`)}
          />

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">
              Saptak Octave
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAPTAKS.map((item) => (
                <Button
                  key={item.octave}
                  variant={octave === item.octave ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setOctave(item.octave)}
                  className="text-[10px] h-7 px-3"
                >
                  Octave {item.octave} ({item.label})
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

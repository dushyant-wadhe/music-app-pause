"use client";

import { useEffect, useMemo, useState } from "react";
import { useTablaStore } from "@/store/useTablaStore";
import { useTablaEngine } from "../hooks/useTablaEngine";
import { BeatVisualizer } from "./BeatVisualizer";
import { TablaRecordingControls, useTablaRecordingController } from "./TablaRecordingControls";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { getCoreVariantsForTaal, getStylePacksForTaal, TAAL_LIST } from "../data/taals";
import { cn } from "@/lib/cn";
import type { TaalName } from "@/types";

function TablaPair({ isPlaying, beat }: { isPlaying: boolean; beat: number }) {
  return (
    <div className="tabla-stage !min-h-[135px] md:!min-h-[150px] !my-1" aria-label="Dayan and bayan tabla pair">
      <div className="tabla-pair scale-90 sm:scale-100 origin-bottom">
        <div className={cn("tabla-drum tabla-dayan", isPlaying && "is-sounding")} key={`dayan-${beat}`}>
          <span className="tabla-rim">
            <span className="tabla-head">
              <span className="tabla-syahi" />
            </span>
          </span>
          <span className="tabla-body" />
        </div>
        <div className={cn("tabla-drum tabla-bayan", isPlaying && "is-sounding")} key={`bayan-${beat}`}>
          <span className="tabla-rim">
            <span className="tabla-head">
              <span className="tabla-syahi" />
            </span>
          </span>
          <span className="tabla-body" />
        </div>
      </div>
      <p className="tabla-stage-caption text-[9px] mt-1">Dayan · Bayan</p>
    </div>
  );
}

export function TablaView() {
  const recordingController = useTablaRecordingController();
  const [showSettings, setShowSettings] = useState(false);

  const {
    bpm, setBpm,
    pitch, setPitch,
    volume, setVolume,
    reverbLevel, setReverbLevel,
    isPlaying, isLooping, toggleLoop,
    mode, setMode,
    countInBeats, setCountInBeats,
    patternLayer, setPatternLayer,
    stylePackId, setStylePackId,
    variantId, setVariantId,
    isCountingIn, countInRemaining,
    currentBeat,
    selectedTaal, setTaal,
  } = useTablaStore();

  const { play, pause, stop, taal, activeVariant } = useTablaEngine();

  const coreVariants = useMemo(() => getCoreVariantsForTaal(selectedTaal), [selectedTaal]);
  const stylePacks = useMemo(() => getStylePacksForTaal(selectedTaal), [selectedTaal]);
  const selectedPack = useMemo(
    () => stylePacks.find((pack) => pack.id === stylePackId) ?? stylePacks[0] ?? null,
    [stylePackId, stylePacks]
  );
  const visibleVariants = useMemo(
    () => (patternLayer === "style-pack" ? selectedPack?.variants ?? [] : coreVariants),
    [coreVariants, patternLayer, selectedPack]
  );

  const activePattern = activeVariant?.pattern?.length ? activeVariant.pattern : taal?.pattern;
  const currentBeatInfo = activePattern?.[currentBeat % (activePattern.length || 1)] ?? null;

  useEffect(() => {
    if (patternLayer === "style-pack" && !selectedPack) {
      setPatternLayer("core");
      if (coreVariants[0]) setVariantId(coreVariants[0].id);
      return;
    }

    if (patternLayer === "style-pack" && selectedPack && stylePackId !== selectedPack.id) {
      setStylePackId(selectedPack.id);
      if (selectedPack.variants[0]) setVariantId(selectedPack.variants[0].id);
      return;
    }

    if (!visibleVariants.some((variant) => variant.id === variantId)) {
      const fallback = visibleVariants[0];
      if (fallback) setVariantId(fallback.id);
    }
  }, [
    coreVariants,
    patternLayer,
    selectedPack,
    setPatternLayer,
    setStylePackId,
    setVariantId,
    stylePackId,
    variantId,
    visibleVariants,
  ]);

  function handleTaalChange(taalName: TaalName) {
    stop();
    setTaal(taalName);
  }

  const TEMPO_PRESETS = [60, 80, 100, 120, 160];

  return (
    <div className="tabla-workspace flex w-full max-w-2xl flex-col gap-4 px-2 py-3 md:py-5 relative">

      {/* ── Outer Header Controls Bar (Matching Harmonium Reference) ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">
            Riyaaz instrument
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">
            Tabla
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
            disabled={recordingController.isStarting || Boolean(recordingController.blobUrl)}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            {recordingController.isStarting ? "Starting..." : "Record"}
          </Button>
        )}
      </div>

      {/* ── Main Performance Cabinet Enclosure ── */}
      <Card glow={isPlaying} className="tabla-performance overflow-hidden border border-[#d7b58d] rounded-xl shadow-lg p-0">
        
        {/* Top Control Bar (Wood-grain header strip matching Harmonium) */}
        <div className="flex items-center justify-between gap-2 border-b border-[#2a1405] bg-gradient-to-r from-[#854d27] to-[#693c1d] px-3.5 py-2 text-[#fdf6e2] shadow-md">
          
          {/* Left: Taal Selector & Mode Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#3d200d] px-2 py-0.5 rounded border border-[#2a1405]">
              <span className="text-[9px] font-bold text-[#fcd34d] uppercase tracking-wider">Taal</span>
              <select
                value={selectedTaal}
                onChange={(event) => handleTaalChange(event.target.value as TaalName)}
                className="h-6 rounded border-0 bg-transparent px-0.5 text-[11px] font-bold text-[#fdf6e2] focus:outline-none cursor-pointer"
                aria-label="Choose taal"
              >
                {TAAL_LIST.map((taalOption) => (
                  <option key={taalOption.name} value={taalOption.name} className="bg-[#5c3a21] text-[#fdf6e2]">
                    {taalOption.name} ({taalOption.beats}m)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-[#3d200d] p-0.5 rounded border border-[#2a1405] h-7">
              <button
                onClick={() => setMode("tabla")}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center",
                  mode === "tabla"
                    ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                    : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
                )}
              >
                Tabla
              </button>
              <button
                onClick={() => setMode("metronome")}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5 flex items-center justify-center",
                  mode === "metronome"
                    ? "bg-[#d97706] text-[#fdf6e2] border-[#b45309] font-extrabold shadow-sm"
                    : "bg-transparent text-[#fcd34d]/80 border-transparent hover:bg-[#5c3a21]"
                )}
              >
                Click
              </button>
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

          {/* Center-Aligned Floating Beat Readout Badge */}
          <div className="flex items-center justify-center gap-2 px-1 flex-wrap">
            <span className="font-serif text-lg font-bold text-[#2f2119]">
              {selectedTaal}
            </span>
            <span className="text-[10px] font-bold text-[#8a5a2b] bg-[#f4e5cf] px-2.5 py-0.5 rounded-full border border-[#cfa675] shadow-xs">
              Matra {isPlaying ? (currentBeat % (taal?.beats || 1)) + 1 : 1} / {taal?.beats}
              {isPlaying && currentBeatInfo ? ` · ${currentBeatInfo.syllable}` : ""}
            </span>
          </div>

          {/* Dayan / Bayan Drums */}
          <TablaPair isPlaying={isPlaying} beat={currentBeat} />

          {/* Beat Visualizer Timeline */}
          <div className="tabla-timeline w-full overflow-x-auto py-1 my-0.5 border-t border-b border-[#dbcdb8]/40 flex justify-center">
            <BeatVisualizer />
          </div>

          {/* Transport Row (Centered Play / Pause / Stop / Loop + Spacebar Hint) */}
          <div className="flex flex-col items-center justify-center gap-2 pt-1 w-full">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {!isPlaying ? (
                <Button onClick={play} size="sm" className="min-w-[90px] h-8 text-xs font-bold gap-1 shadow-sm">
                  ▶ Play <span className="text-[9px] opacity-75 font-normal ml-0.5">(Space)</span>
                </Button>
              ) : (
                <>
                  <Button onClick={pause} variant="surface" size="sm" className="h-8 text-xs font-bold gap-1 shadow-sm">
                    ⏸ Pause <span className="text-[9px] opacity-75 font-normal ml-0.5">(Space)</span>
                  </Button>
                  <Button onClick={stop} variant="outline" size="sm" className="h-8 text-xs">
                    ⏹ Stop
                  </Button>
                </>
              )}
              <Button
                variant={isLooping ? "primary" : "ghost"}
                size="sm"
                onClick={toggleLoop}
                className="h-8 text-xs px-2.5"
                aria-pressed={isLooping}
              >
                ↺ Loop
              </Button>
              {isCountingIn && (
                <Badge variant="muted">Count-in: {countInRemaining}</Badge>
              )}
            </div>

            {/* Sleek Single-Line Tempo Strip (Harmonium Reference Style) */}
            <div className="flex items-center justify-between gap-2.5 w-full max-w-lg bg-[#fbf6ef] px-3 py-1.5 rounded-lg border border-[#e3d7c2] select-none">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#75685b] shrink-0">
                Tempo
              </span>

              {/* Slider Track with 40 / 240 Labels */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                <span className="text-[9px] font-mono text-[#8a7a6b]">40</span>
                <input
                  type="range"
                  min={40}
                  max={240}
                  step={1}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full h-1.5 accent-[#9b6524] cursor-pointer"
                  aria-label="Adjust tempo BPM"
                />
                <span className="text-[9px] font-mono text-[#8a7a6b]">240</span>
              </div>

              {/* Live BPM Badge */}
              <span className="font-mono text-[#8a5a2b] bg-[#f4e5cf] px-2 py-0.5 rounded border border-[#cfa675] text-[11px] font-bold shrink-0">
                {bpm} BPM
              </span>

              {/* Inline Clean Preset Pills */}
              <div className="flex items-center gap-0.5 shrink-0 hidden sm:flex">
                {TEMPO_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setBpm(preset)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border cursor-pointer h-5",
                      bpm === preset
                        ? "bg-[#8a5a2b] text-[#fffdfa] border-[#74451f]"
                        : "bg-[#fffaf3] text-[#55473d] border-[#dfd1bd] hover:bg-[#f4e5cf]"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </Card>

      {/* ── Saved Recordings Section ── */}
      <TablaRecordingControls controller={recordingController} />

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
            ⚙ Advanced Tabla Settings
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
            label="Pitch Tuning"
            value={pitch}
            min={-6}
            max={6}
            onChange={setPitch}
            formatValue={(v) => (v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`)}
          />

          {/* Count-in Selector */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">
              Count-in Beats
            </p>
            <div className="flex flex-wrap gap-1.5">
              {([0, 2, 4, 8] as const).map((beats) => (
                <Button
                  key={beats}
                  variant={countInBeats === beats ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setCountInBeats(beats)}
                  className="text-[10px] h-7 px-2.5"
                >
                  {beats === 0 ? "Off" : `${beats} Beats`}
                </Button>
              ))}
            </div>
          </div>

          {/* Pattern Layer & Variants */}
          <div className="border-t border-[#ead9c1]/60 pt-3 flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">
                Pattern Layer
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={patternLayer === "core" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPatternLayer("core");
                    setStylePackId(null);
                    if (coreVariants[0]) setVariantId(coreVariants[0].id);
                  }}
                  className="text-[10px] h-7 px-2.5"
                >
                  Core Theka
                </Button>
                <Button
                  variant={patternLayer === "style-pack" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPatternLayer("style-pack");
                    const nextPack = stylePacks[0] ?? null;
                    setStylePackId(nextPack?.id ?? null);
                    if (nextPack?.variants[0]) setVariantId(nextPack.variants[0].id);
                  }}
                  disabled={stylePacks.length === 0}
                  className="text-[10px] h-7 px-2.5"
                >
                  Style Pack
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5f6877]">
                Beat Variants
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleVariants.map((variant) => (
                  <Button
                    key={variant.id}
                    variant={variant.id === variantId ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setVariantId(variant.id)}
                    className="text-[10px] h-7 px-2.5"
                  >
                    {variant.name}
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

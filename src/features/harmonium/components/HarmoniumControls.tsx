"use client";

import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { HarmoniumToneMode, HarmoniumTuningMode, RootNote } from "@/types";

export function HarmoniumControls() {
  const {
    volume, setVolume,
    sustain, setSustain,
    octave, setOctave,
    transpose, setTranspose,
    rootNote, setRootNote,
    tuningMode, setTuningMode,
    toneMode, setToneMode,
    bellowsExpression, setBellowsExpression,
  } = useHarmoniumStore();

  const rootNotes: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const tuningOptions: HarmoniumTuningMode[] = ["equal", "natural"];
  const toneOptions: HarmoniumToneMode[] = ["basic", "warm-reed"];

  return (
    <Card className="harmonium-controls flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#ead9c1] pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b512b]">Instrument settings</p>
        <span className="text-[10px] text-[#8d7c69]">MIDI ready</span>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Slider
          label="Volume"
          value={Math.round(volume * 100)}
          min={0}
          max={100}
          onChange={(v) => setVolume(v / 100)}
          formatValue={(v) => `${v}%`}
        />
        <Slider
          label="Octave"
          value={octave}
          min={2}
          max={6}
          onChange={setOctave}
          formatValue={(v) => `Oct ${v}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5f6877]">Root Sa</p>
          <select
            value={rootNote}
            onChange={(event) => setRootNote(event.target.value as RootNote)}
            className="h-11 w-full rounded border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] md:h-9 md:text-xs"
          >
            {rootNotes.map((note) => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
        </div>

      </div>

      <details className="border-t border-[#e3d7c2] pt-3">
        <summary className="cursor-pointer text-xs font-medium text-[#5f6877]">Fine controls</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#6b7280]">Tuning</p>
            <div className="flex gap-1.5 flex-wrap">
              {tuningOptions.map((mode) => (
                <Button key={mode} variant={tuningMode === mode ? "primary" : "outline"} size="sm" onClick={() => setTuningMode(mode)}>
                  {mode === "equal" ? "Equal" : "Natural"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#6b7280]">Tone</p>
            <div className="flex gap-1.5 flex-wrap">
              {toneOptions.map((mode) => (
                <Button key={mode} variant={toneMode === mode ? "primary" : "outline"} size="sm" onClick={() => setToneMode(mode)}>
                  {mode === "basic" ? "Basic Synth" : "Warm Reed"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}

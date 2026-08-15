"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import { TanpuraRecordingControls, useTanpuraRecordingController } from "@/features/tanpura/components/TanpuraRecordingControls";
import { useTanpuraStore } from "@/store/useTanpuraStore";
import type { RootNote } from "@/types";

const ROOT_NOTES: RootNote[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function TanpuraView() {
  const recordingController = useTanpuraRecordingController();
  const { mode, rootNote, octave, volume, setMode, setRootNote, setOctave, setVolume } = useTanpuraStore();
  const isPlaying = mode !== "off";

  return (
    <div className="tanpura-workspace mx-auto flex w-full max-w-xl flex-col gap-5 px-2 py-3 md:py-5">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">Riyaaz instrument</p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">Tanpura</h1>
          <p className="mt-1 text-xs text-[#75685b]">A quiet foundation for your riyāz.</p>
        </div>
        {recordingController.isRecording ? (
          <Button variant="danger" size="sm" onClick={recordingController.handleStop}>
            <span className="h-2 w-2 rounded-full bg-[#fecaca] animate-pulse" aria-hidden="true" />
            Stop recording
          </Button>
        ) : (
          <Button
            variant="surface"
            size="sm"
            onClick={recordingController.handleStart}
            disabled={recordingController.isStarting || Boolean(recordingController.blobUrl)}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" aria-hidden="true" />
            {recordingController.isStarting ? "Starting..." : "Record"}
          </Button>
        )}
      </div>
      <div className="tanpura-main-grid">
      <section className="tanpura-stage" aria-label="Tanpura drone instrument">
        <div className={`tanpura-instrument ${isPlaying ? "is-playing" : ""}`} aria-hidden="true">
          <div className="tanpura-neck"><span className="tanpura-peg peg-one" /><span className="tanpura-peg peg-two" /><span className="tanpura-peg peg-three" /><span className="tanpura-peg peg-four" /></div>
          <div className="tanpura-body"><span className="tanpura-rosette" /><span className="tanpura-bridge" /><div className="tanpura-strings"><i /><i /><i /><i /></div></div>
        </div>
        <p className="tanpura-stage-caption">{isPlaying ? "Drone sustaining" : "Drone at rest"}</p>
      </section>

      <Card className="tanpura-controls flex flex-col gap-4 p-4">
        <div className="text-center">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b512b]">Drone</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(["off", "sa", "sa+pa"] as const).map((option) => (
              <Button key={option} size="sm" variant={mode === option ? "primary" : "outline"} onClick={() => setMode(option)}>
                {option === "off" ? "Off" : option === "sa" ? "Sa" : "Sa + Pa"}
              </Button>
            ))}
          </div>
        </div>
        <Slider label="Volume" value={Math.round(volume * 100)} min={0} max={100} onChange={(value) => setVolume(value / 100)} formatValue={(value) => `${value}%`} />
        <details className="border-t border-[#e3d7c2] pt-3">
          <summary className="cursor-pointer text-xs font-medium text-[#5f6877]">More drone controls</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5f6877]">Root Sa</p>
              <select value={rootNote} onChange={(event) => setRootNote(event.target.value as RootNote)} className="h-11 w-full rounded border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] md:h-9 md:text-xs">
                {ROOT_NOTES.map((note) => <option key={note} value={note}>{note}</option>)}
              </select>
            </div>
            <Slider label="Octave" value={octave} min={2} max={5} onChange={setOctave} formatValue={(value) => `Oct ${value}`} />
          </div>
        </details>
      </Card>
      </div>

      <TanpuraRecordingControls controller={recordingController} />
    </div>
  );
}

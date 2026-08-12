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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d232d]">Tanpura</h1>
          <p className="text-xs text-[#5f6877]">Set your drone and hold pitch with confidence.</p>
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
      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5f6877]">Drone</p>
          <div className="flex flex-wrap gap-2">
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

      <TanpuraRecordingControls controller={recordingController} />
    </div>
  );
}

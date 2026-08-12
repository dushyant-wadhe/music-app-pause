"use client";

import { useHarmoniumEngine } from "../hooks/useHarmoniumEngine";
import { HarmoniumKeyboard } from "./HarmoniumKeyboard";
import { HarmoniumControls } from "./HarmoniumControls";
import { Button } from "@/components/ui/Button";
import { RecordingControls, useRecordingController } from "./RecordingControls";
import { ActiveNoteDisplay } from "./ActiveNoteDisplay";

export function HarmoniumView() {
  const { handleNoteOn, handleNoteOff } = useHarmoniumEngine();
  const recordingController = useRecordingController();

  return (
    <div className="flex w-full flex-col gap-5 px-2 py-3 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d232d]">Harmonium</h1>
          <p className="text-xs text-[#5f6877]">A S D F G H J for white keys, W E T Y U for black keys.</p>
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
            disabled={recordingController.isStarting}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            {recordingController.isStarting ? "Starting…" : "Record"}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2 shadow-[0_8px_20px_rgba(74,47,18,0.1)]">
        <div className="overflow-hidden rounded-md border border-[var(--surface-muted)] bg-[var(--surface-soft)]">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ink-soft)]">Performance</p>
            <ActiveNoteDisplay />
          </div>
          <div className="p-3 pb-1">
            <HarmoniumKeyboard onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
          </div>
        </div>
      </div>

      <HarmoniumControls />

      <RecordingControls controller={recordingController} />
    </div>
  );
}

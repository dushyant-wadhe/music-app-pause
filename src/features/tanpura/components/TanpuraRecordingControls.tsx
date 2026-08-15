"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MiniAudioPlayer } from "@/features/harmonium/components/RecordingControls";
import { startTanpuraAudioCapture, stopTanpuraAudioCapture } from "@/features/tanpura/engine/audioEngine";
import { saveBlobUrlAsRecording } from "@/services/localRecordingStorage";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { Recording } from "@/types";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatSavedAt(value: Date | string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface TanpuraRecordingController {
  isRecording: boolean;
  isStarting: boolean;
  blobUrl: string | null;
  recordingName: string;
  error: string | null;
  recordingsCount: number;
  recordings: Recording[];
  setRecordingName: (value: string) => void;
  handleStart: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleDiscard: () => void;
  handleDeleteSavedRecording: (id: string, name: string) => void;
}

export function useTanpuraRecordingController(): TanpuraRecordingController {
  const recordings = useLibraryStore((state) => state.recordings);
  const addRecording = useLibraryStore((state) => state.addRecording);
  const deleteRecording = useLibraryStore((state) => state.deleteRecording);
  const updateStats = useProfileStore((state) => state.updateStats);

  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const tanpuraRecordings = recordings
    .filter((recording) => recording.tags.includes("tanpura"))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);

  async function handleStart() {
    if (isStarting) return;
    setError(null);
    setIsStarting(true);
    try {
      await startTanpuraAudioCapture((message) => {
        setIsRecording(false);
        setError(message);
      });
      setStartedAt(Date.now());
      setIsRecording(true);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Recording could not start.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    setIsRecording(false);
    setDurationSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    const blob = await stopTanpuraAudioCapture();
    if (!blob || blob.size === 0) {
      setError("No audio was captured. Please try recording again.");
      return;
    }
    setBlobUrl(URL.createObjectURL(blob));
  }

  async function handleSave() {
    if (!blobUrl) return;
    const id = crypto.randomUUID();
    let storageUrl: string | null = null;
    try {
      storageUrl = await saveBlobUrlAsRecording(id, blobUrl);
    } catch {
      storageUrl = null;
    }

    addRecording({
      id,
      uid: "",
      name: recordingName.trim() || `Tanpura ${new Date().toLocaleString()}`,
      durationSeconds,
      createdAt: new Date(),
      storageUrl,
      isFavorite: false,
      notes: "",
      tags: ["tanpura"],
      instrument: "other",
      blobUrl,
    });
    updateStats({ recordingsCount: recordings.length + 1 });
    setBlobUrl(null);
    setRecordingName("");
  }

  function handleDiscard() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setRecordingName("");
  }

  function handleDeleteSavedRecording(id: string, name: string) {
    void name;
    deleteRecording(id);
  }

  return {
    isRecording,
    isStarting,
    blobUrl,
    recordingName,
    error,
    recordingsCount: tanpuraRecordings.length,
    recordings: tanpuraRecordings,
    setRecordingName,
    handleStart,
    handleStop,
    handleSave,
    handleDiscard,
    handleDeleteSavedRecording,
  };
}

interface TanpuraRecordingControlsProps {
  controller: TanpuraRecordingController;
}

export function TanpuraRecordingControls({ controller }: TanpuraRecordingControlsProps) {
  const {
    blobUrl,
    recordingName,
    error,
    recordings,
    recordingsCount,
    setRecordingName,
    handleSave,
    handleDiscard,
    handleDeleteSavedRecording,
  } = controller;

  const [isListOpen, setIsListOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  if (!blobUrl && !error && recordingsCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="p-3">
        {error && <p role="alert" className="mt-2 text-xs text-[#b91c1c]">{error}</p>}
        {recordings.length > 0 && (
          <button
            type="button"
            onClick={() => setIsListOpen((isOpen) => !isOpen)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={isListOpen}
          >
            <span className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">Recordings ({recordings.length})</span>
            <span className="text-xs font-medium text-[#8a5a2b]">{isListOpen ? "Hide" : "Show"}</span>
          </button>
        )}

        {isListOpen && (
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
            {recordings.map((recording) => (
              <div key={recording.id} className="flex flex-wrap items-center gap-2 rounded border border-[#d1d5db] bg-[#fcfaf6] px-2.5 py-2">
                <div className="min-w-28 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827]">{recording.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#6b7280]">{formatSavedAt(recording.createdAt)} • {formatDuration(recording.durationSeconds)}</p>
                </div>
                {recording.blobUrl ? <div className="min-w-44 flex-1"><MiniAudioPlayer src={recording.blobUrl} /></div> : null}
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ id: recording.id, name: recording.name })}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {blobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 p-4" role="presentation">
          <div className="w-full max-w-sm rounded border border-[#d9c8ae] bg-[#fffaf0] p-4 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="save-tanpura-recording-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p id="save-tanpura-recording-title" className="text-sm font-semibold text-[#111827]">Save recording</p>
                <p className="mt-0.5 text-xs text-[#6b7280]">Give this take a name before adding it to your recordings.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDiscard} aria-label="Discard recording">Close</Button>
            </div>
            <MiniAudioPlayer src={blobUrl} />
            <input
              autoFocus
              type="text"
              value={recordingName}
              onChange={(event) => setRecordingName(event.target.value)}
              placeholder="Recording name"
              className="mt-3 w-full rounded border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#8a5a2b] focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard}>Discard</Button>
              <Button size="sm" onClick={handleSave}>Save recording</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete recording"
        message={deleteTarget ? `Delete ${deleteTarget.name}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDeleteSavedRecording(deleteTarget.id, deleteTarget.name);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

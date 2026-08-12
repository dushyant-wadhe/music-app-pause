"use client";

import { useEffect, useRef, useState } from "react";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { saveBlobUrlAsRecording } from "@/services/localRecordingStorage";
import { startAudioCapture, stopAudioCapture } from "../engine/audioEngine";

export interface RecordingController {
  isRecording: boolean;
  recordedNotesCount: number;
  recordingsCount: number;
  sortedRecordings: ReturnType<typeof useLibraryStore.getState>["recordings"];
  savedBlobUrl: string | null;
  recordingName: string;
  error: string | null;
  isStarting: boolean;
  setRecordingName: (value: string) => void;
  handleStart: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleDiscard: () => void;
  handleDeleteSavedRecording: (id: string, name: string) => void;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatSavedAt(value: Date | string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function MiniAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    updateDuration();
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  }

  function handleStop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function handleSeek(nextValue: number) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const nextTime = (nextValue / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="mt-1.5 rounded border border-[#dfd3bf] bg-[#f8f2e8] px-2 py-1.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#cdb38e] bg-[#fffaf0] text-[11px] font-semibold text-[#8a5a2b] hover:bg-[#f3e7d6]"
          aria-label={isPlaying ? "Pause recording" : "Play recording"}
        >
          {isPlaying ? "II" : "▶"}
        </button>

        <button
          type="button"
          onClick={handleStop}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#cdb38e] bg-[#fffaf0] text-[11px] font-semibold text-[#8a5a2b] hover:bg-[#f3e7d6]"
          aria-label="Stop playback"
        >
          []
        </button>

        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={(event) => handleSeek(Number(event.target.value))}
          className="h-1 w-full accent-[#c48942]"
          aria-label="Seek recording"
        />

        <span className="shrink-0 text-[10px] text-[#7a6650]">
          {formatClock(currentTime)} / {formatClock(duration)}
        </span>
      </div>
    </div>
  );
}

export function useRecordingController(): RecordingController {
  const { isRecording, startRecording, stopRecording, recordedNotes } = useHarmoniumStore();
  const addRecording = useLibraryStore((s) => s.addRecording);
  const recordings = useLibraryStore((s) => s.recordings);
  const deleteRecording = useLibraryStore((s) => s.deleteRecording);
  const updateStats  = useProfileStore((s) => s.updateStats);
  const recordingCount = useLibraryStore((s) => s.recordings.length);

  const [recordingName, setRecordingName] = useState("");
  const [savedBlobUrl, setSavedBlobUrl]   = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startTimeRef  = useRef<number>(0);
  const durationRef   = useRef<number>(0);

  const sortedRecordings = recordings
    .filter((recording) => recording.instrument === "harmonium")
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);

  async function handleStart() {
    if (isStarting) return;
    if (savedBlobUrl) URL.revokeObjectURL(savedBlobUrl);
    setError(null);
    setRecordingName("");
    setSavedBlobUrl(null);
    setIsStarting(true);
    try {
      await startAudioCapture((message) => {
        stopRecording();
        setError(message);
      });
      startTimeRef.current = Date.now();
      startRecording();
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : "Recording could not start.";
      setError(message);
      stopRecording();
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    setError(null);
    durationRef.current = Math.round((Date.now() - startTimeRef.current) / 1000);
    stopRecording();
    try {
      const blob = await stopAudioCapture();
      if (!blob || blob.size === 0) {
        setError("No audio was captured. Please try recording again.");
        return;
      }
      setSavedBlobUrl(URL.createObjectURL(blob));
    } catch {
      setError("Recording could not be saved. Please try again.");
    }
  }

  async function handleSave() {
    if (!savedBlobUrl) return;
    const id = crypto.randomUUID();
    let storageUrl: string | null = null;
    try {
      storageUrl = await saveBlobUrlAsRecording(id, savedBlobUrl);
    } catch {
      storageUrl = null;
    }

    const name = recordingName.trim() || `Recording ${new Date().toLocaleString()}`;
    addRecording({
      id,
      uid: "",
      name,
      durationSeconds: durationRef.current,
      createdAt: new Date(),
      storageUrl,
      isFavorite: false,
      notes: "",
      tags: [],
      instrument: "harmonium",
      blobUrl: savedBlobUrl,
    });
    updateStats({ recordingsCount: recordingCount + 1 });
    setSavedBlobUrl(null);
    setRecordingName("");
  }

  function handleDiscard() {
    if (savedBlobUrl) URL.revokeObjectURL(savedBlobUrl);
    setSavedBlobUrl(null);
    setRecordingName("");
  }

  function handleDeleteSavedRecording(id: string, name: string) {
    void name;
    deleteRecording(id);
  }

  return {
    isRecording,
    recordedNotesCount: recordedNotes.length,
    recordingsCount: sortedRecordings.length,
    sortedRecordings,
    savedBlobUrl,
    recordingName,
    error,
    isStarting,
    setRecordingName,
    handleStart,
    handleStop,
    handleSave,
    handleDiscard,
    handleDeleteSavedRecording,
  };
}

interface RecordingControlsProps {
  controller: RecordingController;
}

export function RecordingControls({ controller }: RecordingControlsProps) {
  const {
    recordingsCount,
    sortedRecordings,
    savedBlobUrl,
    recordingName,
    error,
    setRecordingName,
    handleSave,
    handleDiscard,
    handleDeleteSavedRecording,
  } = controller;
  const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const hasSavedFlow = Boolean(savedBlobUrl);
  const hasRecordings = recordingsCount > 0;

  if (!hasSavedFlow && !hasRecordings && !error) return null;

  return (
    <>
      {hasSavedFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 p-4" role="presentation">
          <div className="w-full max-w-sm rounded border border-[#d9c8ae] bg-[#fffaf0] p-4 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="save-recording-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p id="save-recording-title" className="text-sm font-semibold text-[#111827]">Save recording</p>
                <p className="mt-0.5 text-xs text-[#6b7280]">Give this take a name before adding it to your recordings.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDiscard} aria-label="Discard recording">Close</Button>
            </div>
            <MiniAudioPlayer src={savedBlobUrl!} />
            <input
              autoFocus
              type="text"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
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

      {(hasRecordings || error) && (
        <Card>
          {error && (
            <p role="alert" className="text-xs text-[#b91c1c]">{error}</p>
          )}

          {hasRecordings && (
            <div className={cn(error && "mt-3 border-t border-[#e8e1d4] pt-3")}>
              <button
                type="button"
                onClick={() => setIsRecordingsOpen((isOpen) => !isOpen)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={isRecordingsOpen}
              >
                <span className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">Recordings ({recordingsCount})</span>
                <span className="text-xs font-medium text-[#8a5a2b]">{isRecordingsOpen ? "Hide" : "Show"}</span>
              </button>

              {isRecordingsOpen && (
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {sortedRecordings.map((recording) => (
                    <div key={recording.id} className="flex flex-wrap items-center gap-2 rounded border border-[#d1d5db] bg-[#fcfaf6] px-2.5 py-2">
                      <div className="min-w-28 flex-1">
                        <p className="truncate text-sm font-medium text-[#111827]">{recording.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#6b7280]">
                          {formatSavedAt(recording.createdAt)} • {formatDuration(recording.durationSeconds)}
                        </p>
                      </div>
                      {recording.blobUrl ? (
                        <div className="min-w-44 flex-1"><MiniAudioPlayer src={recording.blobUrl} /></div>
                      ) : (
                        <p className="min-w-44 text-[11px] text-[#9ca3af]">Audio unavailable on this device.</p>
                      )}
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ id: recording.id, name: recording.name })}>Delete</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
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

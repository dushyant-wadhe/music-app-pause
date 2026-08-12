"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoaderState } from "@/components/ui/LoaderState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { Recording } from "@/types";

function formatSavedTime(value: Date | string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function HomeSessionsView() {
  const router = useRouter();
  const hasHydrated = useLibraryStore((state) => state.hasHydrated);
  const recordings = useLibraryStore((state) => state.recordings);
  const playingId = useLibraryStore((state) => state.playingId);
  const setPlayingId = useLibraryStore((state) => state.setPlayingId);
  const createSession = useLibraryStore((state) => state.createSession);
  const deleteRecording = useLibraryStore((state) => state.deleteRecording);
  const playSession = useLibraryStore((state) => state.playSession);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [playErrorId, setPlayErrorId] = useState<string | null>(null);

  const recordedSessions = useMemo(
    () => recordings
      .filter((recording) => recording.tags.includes("session"))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [recordings]
  );

  function handleCreateSession() {
    const id = createSession();
    playSession(id);
    router.push(`/session/${id}`);
  }

  async function handlePlayPause(recording: Recording) {
    if (!recording.blobUrl) return;
    const nextAudio = audioRefs.current[recording.id];
    if (!nextAudio) return;

    if (playingId === recording.id) {
      nextAudio.pause();
      setPlayingId(null);
      setPlayErrorId(null);
      return;
    }

    if (playingId) {
      const currentAudio = audioRefs.current[playingId];
      if (currentAudio) {
        currentAudio.pause();
      }
    }

    try {
      if (nextAudio.readyState === 0) {
        nextAudio.load();
      }
      await nextAudio.play();
      setPlayingId(recording.id);
      setPlayErrorId(null);
    } catch {
      setPlayingId(null);
      setPlayErrorId(recording.id);
    }
  }

  function handleDeleteRecording(event: React.MouseEvent<HTMLButtonElement>, id: string, name: string) {
    event.preventDefault();
    event.stopPropagation();
    setDeleteTarget({ id, name });
  }

  function confirmDeleteRecording() {
    if (!deleteTarget) return;
    deleteRecording(deleteTarget.id);
    if (playingId === deleteTarget.id) {
      setPlayingId(null);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-4">
      <PageHeader
        title="Recorded Sessions"
        subtitle="Only recorded practice appears here."
        action={<Button size="sm" onClick={handleCreateSession}>Start Session</Button>}
      />

      <div className="flex flex-col gap-3">
        {!hasHydrated ? (
          <LoaderState label="Loading sessions..." />
        ) : recordedSessions.length === 0 ? (
          <EmptyState message="No recorded sessions yet. Start a session and record to save it." />
        ) : (
          <>
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-[#5f6877]">Your recordings</p>
            {recordedSessions.map((recording) => (
              <div
                key={recording.id}
                className="rounded border border-[#d1d5db] bg-white px-3 py-2"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[#1d232d]">{recording.name}</h2>
                    <p className="truncate text-[10px] text-[#6b7280]">
                      {formatSavedTime(recording.createdAt)} · {formatDuration(recording.durationSeconds)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={playingId === recording.id ? "surface" : "outline"}
                      onClick={() => handlePlayPause(recording)}
                      aria-label={playingId === recording.id ? `Pause ${recording.name}` : `Play ${recording.name}`}
                      disabled={!recording.blobUrl}
                    >
                      {playingId === recording.id ? "Pause" : "Play"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(event) => handleDeleteRecording(event, recording.id, recording.name)}
                      aria-label={`Delete ${recording.name}`}
                      title="Delete recording"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {recording.blobUrl ? (
                  <audio
                    preload="metadata"
                    ref={(node) => {
                      audioRefs.current[recording.id] = node;
                    }}
                    onEnded={() => setPlayingId(null)}
                    src={recording.blobUrl}
                    className="hidden"
                  />
                ) : null}
                {!recording.blobUrl ? (
                  <p className="mt-1 text-[11px] text-[#9ca3af]">Audio unavailable for this recording on this device.</p>
                ) : null}
                {playErrorId === recording.id ? (
                  <p className="mt-1 text-[11px] text-[#b91c1c]">Could not play this recording.</p>
                ) : null}
              </div>
            ))}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete recording"
        message={deleteTarget ? `Delete ${deleteTarget.name}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRecording}
      />
    </div>
  );
}

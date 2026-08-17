"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoaderState } from "@/components/ui/LoaderState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { Recording, SessionInstrument } from "@/types";

const INSTRUMENT_ORDER: SessionInstrument[] = ["harmonium", "tabla", "tanpura", "flute"];
const INSTRUMENT_LABEL: Record<SessionInstrument, string> = {
  harmonium: "Harmonium",
  tabla: "Tabla",
  tanpura: "Tanpura",
  flute: "Flute",
};
const INSTRUMENT_STROKE: Record<SessionInstrument, string> = {
  harmonium: "#8a5a2b",
  tabla: "#2563eb",
  tanpura: "#059669",
  flute: "#7c3aed",
};

async function decodeWaveformSamples(blobUrl: string, bins = 120): Promise<number[]> {
  const response = await fetch(blobUrl);
  if (!response.ok) throw new Error("Failed to read audio source.");
  const arrayBuffer = await response.arrayBuffer();

  const audioContext = new AudioContext({ latencyHint: "playback" });
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    if (!channelData.length) return Array.from({ length: bins }, () => 0);

    const bucketSize = Math.max(1, Math.floor(channelData.length / bins));
    const samples: number[] = [];
    for (let bucket = 0; bucket < bins; bucket += 1) {
      const start = bucket * bucketSize;
      const end = Math.min(channelData.length, start + bucketSize);
      let peak = 0;
      for (let index = start; index < end; index += 1) {
        const amplitude = Math.abs(channelData[index] ?? 0);
        if (amplitude > peak) peak = amplitude;
      }
      samples.push(Math.min(1, peak));
    }
    return samples;
  } finally {
    void audioContext.close();
  }
}

function waveformPoints(samples: number[]): string {
  if (!samples.length) return "";
  if (samples.length === 1) return "0,50 100,50";

  return samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * 100;
      const y = 50 - Math.max(2, sample * 45);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

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
  const stemAudioRefs = useRef<Record<string, Partial<Record<SessionInstrument, HTMLAudioElement | null>>>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [playErrorId, setPlayErrorId] = useState<string | null>(null);
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);
  const [waveformByRecordingId, setWaveformByRecordingId] = useState<
    Record<string, Partial<Record<SessionInstrument, number[]>>>
  >({});
  const [cursorByRecordingId, setCursorByRecordingId] = useState<Record<string, number>>({});
  const [waveformLoadingId, setWaveformLoadingId] = useState<string | null>(null);
  const [toolEnabledByRecordingId, setToolEnabledByRecordingId] = useState<
    Record<string, Partial<Record<SessionInstrument, boolean>>>
  >({});

  const recordedSessions = useMemo(
    () => recordings
      .filter((recording) => recording.tags.includes("session"))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [recordings]
  );

  const recordingsById = useMemo(
    () => Object.fromEntries(recordedSessions.map((recording) => [recording.id, recording])) as Record<string, Recording>,
    [recordedSessions]
  );

  useEffect(() => {
    if (!expandedRecordingId) return;
    const recording = recordingsById[expandedRecordingId];
    if (!recording) return;
    if (waveformByRecordingId[recording.id]) return;

    const instruments = getCapturedInstruments(recording);
    if (instruments.length === 0) return;

    let cancelled = false;

    async function loadWaveforms() {
      setWaveformLoadingId(recording.id);
      const waveforms: Partial<Record<SessionInstrument, number[]>> = {};

      for (const instrument of instruments) {
        const source = recording.stemBlobUrls?.[instrument] ?? recording.blobUrl;
        if (!source) continue;
        try {
          waveforms[instrument] = await decodeWaveformSamples(source);
        } catch {
          // Ignore per-instrument decode failures and keep remaining graphs.
        }
      }

      if (cancelled) return;
      setWaveformByRecordingId((current) => ({
        ...current,
        [recording.id]: waveforms,
      }));
      setWaveformLoadingId((current) => (current === recording.id ? null : current));
    }

    void loadWaveforms();
    return () => {
      cancelled = true;
    };
  }, [expandedRecordingId, recordingsById, waveformByRecordingId]);

  function handleCreateSession() {
    const id = createSession();
    playSession(id);
    router.push(`/session/${id}`);
  }

  function getPlayableStemInstruments(recording: Recording): SessionInstrument[] {
    return getCapturedInstruments(recording).filter((tool) => Boolean(recording.stemBlobUrls?.[tool]));
  }

  function isToolEnabled(recordingId: string, tool: SessionInstrument) {
    return toolEnabledByRecordingId[recordingId]?.[tool] ?? true;
  }

  function pauseStemAudios(recordingId: string) {
    const stems = stemAudioRefs.current[recordingId] ?? {};
    Object.values(stems).forEach((audio) => audio?.pause());
  }

  function syncStemMixVolumes(recording: Recording) {
    const stems = stemAudioRefs.current[recording.id] ?? {};
    getPlayableStemInstruments(recording).forEach((tool) => {
      const stemAudio = stems[tool];
      if (!stemAudio) return;
      stemAudio.volume = isToolEnabled(recording.id, tool) ? 1 : 0;
    });
  }

  async function handlePlayPause(recording: Recording) {
    if (!recording.blobUrl) return;
    const nextAudio = audioRefs.current[recording.id];
    if (!nextAudio) return;
    const useStemMix = getPlayableStemInstruments(recording).length > 0;

    if (playingId === recording.id) {
      nextAudio.pause();
      pauseStemAudios(recording.id);
      setPlayingId(null);
      setPlayErrorId(null);
      return;
    }

    if (playingId) {
      const currentAudio = audioRefs.current[playingId];
      if (currentAudio) {
        currentAudio.pause();
      }
      pauseStemAudios(playingId);
    }

    try {
      if (nextAudio.readyState === 0) {
        nextAudio.load();
      }

      if (!useStemMix) {
        nextAudio.muted = false;
        nextAudio.volume = 1;
        await nextAudio.play();
      } else {
        const targetTime = Math.max(0, Math.min(recording.durationSeconds, cursorByRecordingId[recording.id] ?? nextAudio.currentTime));
        const stemTools = getPlayableStemInstruments(recording);
        const stems = stemAudioRefs.current[recording.id] ?? {};

        nextAudio.currentTime = targetTime;
        nextAudio.muted = true;
        nextAudio.volume = 0;

        stemTools.forEach((tool) => {
          const stemAudio = stems[tool];
          if (!stemAudio) return;
          if (stemAudio.readyState === 0) {
            stemAudio.load();
          }
          stemAudio.currentTime = targetTime;
          stemAudio.muted = false;
        });

        syncStemMixVolumes(recording);
        await nextAudio.play();
        await Promise.all(
          stemTools.map((tool) => {
            const stemAudio = stems[tool];
            if (!stemAudio) return Promise.resolve();
            return stemAudio.play().catch(() => undefined);
          })
        );
      }

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

  function getCapturedInstruments(recording: Recording): SessionInstrument[] {
    if (recording.capturedInstruments?.length) {
      return recording.capturedInstruments;
    }

    const taggedTools = recording.tags
      .filter((tag) => tag.startsWith("tool:"))
      .map((tag) => tag.replace("tool:", ""))
      .filter((tool): tool is SessionInstrument => INSTRUMENT_ORDER.includes(tool as SessionInstrument));

    return taggedTools;
  }

  function activityPercentage(recording: Recording, instrument: SessionInstrument) {
    const duration = Math.max(1, recording.durationSeconds);
    const seconds = Math.max(0, recording.instrumentActivitySeconds?.[instrument] ?? 0);
    return Math.min(100, Math.round((seconds / duration) * 100));
  }

  function handleSeek(recording: Recording, nextSeconds: number) {
    const audio = audioRefs.current[recording.id];
    if (!audio) return;
    const targetTime = Math.max(0, Math.min(recording.durationSeconds, nextSeconds));
    audio.currentTime = targetTime;
    const stems = stemAudioRefs.current[recording.id] ?? {};
    Object.values(stems).forEach((stemAudio) => {
      if (stemAudio) stemAudio.currentTime = targetTime;
    });
    setCursorByRecordingId((current) => ({
      ...current,
      [recording.id]: audio.currentTime,
    }));
  }

  function toggleTool(recording: Recording, tool: SessionInstrument) {
    const nextEnabled = !isToolEnabled(recording.id, tool);
    setToolEnabledByRecordingId((current) => ({
      ...current,
      [recording.id]: {
        ...(current[recording.id] ?? {}),
        [tool]: nextEnabled,
      },
    }));

    const stemAudio = stemAudioRefs.current[recording.id]?.[tool];
    if (stemAudio) {
      stemAudio.volume = nextEnabled ? 1 : 0;
    }
  }

  function seekFromPointer(recording: Recording, clientX: number, rect: DOMRect) {
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    handleSeek(recording, ratio * recording.durationSeconds);
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
                      variant="ghost"
                      onClick={() => setExpandedRecordingId((current) => current === recording.id ? null : recording.id)}
                      aria-label={expandedRecordingId === recording.id ? `Collapse ${recording.name}` : `Expand ${recording.name}`}
                      title={expandedRecordingId === recording.id ? "Collapse details" : "Expand details"}
                    >
                      {expandedRecordingId === recording.id ? "Hide" : "Expand"}
                    </Button>
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
                    onTimeUpdate={(event) => {
                      const currentTime = event.currentTarget.currentTime;
                      setCursorByRecordingId((current) => {
                        if (Math.abs((current[recording.id] ?? 0) - currentTime) < 0.05) return current;
                        return {
                          ...current,
                          [recording.id]: currentTime,
                        };
                      });
                    }}
                    onEnded={() => {
                      pauseStemAudios(recording.id);
                      setPlayingId(null);
                    }}
                    src={recording.blobUrl}
                    className="hidden"
                  />
                ) : null}
                {getPlayableStemInstruments(recording).map((tool) => (
                  <audio
                    key={`${recording.id}-${tool}-stem`}
                    preload="metadata"
                    ref={(node) => {
                      stemAudioRefs.current[recording.id] = {
                        ...(stemAudioRefs.current[recording.id] ?? {}),
                        [tool]: node,
                      };
                    }}
                    src={recording.stemBlobUrls?.[tool]}
                    className="hidden"
                  />
                ))}
                {!recording.blobUrl ? (
                  <p className="mt-1 text-[11px] text-[#9ca3af]">Audio unavailable for this recording on this device.</p>
                ) : null}
                {playErrorId === recording.id ? (
                  <p className="mt-1 text-[11px] text-[#b91c1c]">Could not play this recording.</p>
                ) : null}
                {expandedRecordingId === recording.id ? (
                  <div className="mt-3 rounded border border-[#d8c5a6] bg-[linear-gradient(180deg,#fff9ef_0%,#f6ebd8_100%)] p-3 shadow-[inset_0_1px_0_#fff9ef]">
                    {getCapturedInstruments(recording).length === 0 ? (
                      <p className="mb-2 text-[11px] text-[#64748b]">No instrument metadata available for this recording.</p>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7b512b]">Mix Graph</p>
                          <p className="text-[10px] text-[#6b7280]">Live cursor + seek</p>
                        </div>
                        {(() => {
                          const tools = INSTRUMENT_ORDER.filter((tool) => getCapturedInstruments(recording).includes(tool));
                          const currentTime = cursorByRecordingId[recording.id] ?? 0;
                          const progress = recording.durationSeconds > 0
                            ? Math.max(0, Math.min(100, (currentTime / recording.durationSeconds) * 100))
                            : 0;

                          return (
                            <div className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-start gap-2">
                              <div className="grid gap-2">
                                {tools.map((tool) => {
                                  const seconds = recording.instrumentActivitySeconds?.[tool] ?? 0;
                                  const pct = activityPercentage(recording, tool);
                                  const enabled = isToolEnabled(recording.id, tool);
                                  return (
                                    <div key={`${recording.id}-${tool}-label`} className="h-9">
                                      <div className="flex items-center justify-between gap-1">
                                        <p className="text-[10px] font-semibold text-[#2f2119]">{INSTRUMENT_LABEL[tool]}</p>
                                        <button
                                          type="button"
                                          className={`inline-flex h-5 w-5 items-center justify-center rounded border transition ${enabled
                                            ? "border-[#9a6b3f] bg-[#f8ecd8] text-[#5b3d22]"
                                            : "border-[#c3b59f] bg-[#f3efe8] text-[#7a7064]"}`}
                                          onClick={() => toggleTool(recording, tool)}
                                          aria-label={`${enabled ? "Turn off" : "Turn on"} ${INSTRUMENT_LABEL[tool]}`}
                                          title={`${enabled ? "Turn off" : "Turn on"} ${INSTRUMENT_LABEL[tool]}`}
                                        >
                                          {enabled ? (
                                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                                              <path
                                                d="M3 10v4h4l5 4V6L7 10H3zm12.5 2c0-1.8-1-3.3-2.5-4.1v8.2c1.5-.8 2.5-2.3 2.5-4.1zm2.5 0c0 3-1.7 5.6-4.2 6.9l-1-1.7c1.9-1 3.2-3 3.2-5.2s-1.3-4.2-3.2-5.2l1-1.7c2.5 1.3 4.2 3.9 4.2 6.9z"
                                                fill="currentColor"
                                              />
                                            </svg>
                                          ) : (
                                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                                              <path
                                                d="M3 10v4h4l5 4V6L7 10H3z"
                                                fill="currentColor"
                                              />
                                              <path
                                                d="M16 9l5 5m0-5l-5 5"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                              />
                                            </svg>
                                          )}
                                        </button>
                                      </div>
                                      <p className="text-[10px] text-[#6b7280]">{Math.round(seconds)}s · {pct}%</p>
                                    </div>
                                  );
                                })}
                              </div>

                              <div
                                className="relative grid gap-2 cursor-pointer"
                                onPointerDown={(event) => {
                                  const target = event.currentTarget;
                                  target.setPointerCapture(event.pointerId);
                                  seekFromPointer(recording, event.clientX, target.getBoundingClientRect());
                                }}
                                onPointerMove={(event) => {
                                  if ((event.buttons & 1) !== 1) return;
                                  seekFromPointer(recording, event.clientX, event.currentTarget.getBoundingClientRect());
                                }}
                                onPointerUp={(event) => {
                                  seekFromPointer(recording, event.clientX, event.currentTarget.getBoundingClientRect());
                                  event.currentTarget.releasePointerCapture(event.pointerId);
                                }}
                              >
                                {tools.map((tool) => {
                                  const samples = waveformByRecordingId[recording.id]?.[tool] ?? [];
                                  const enabled = isToolEnabled(recording.id, tool);
                                  const laneStroke = enabled ? INSTRUMENT_STROKE[tool] : "#9ca3af";

                                  return (
                                    <div
                                      key={`${recording.id}-${tool}-lane`}
                                      className={`relative h-9 overflow-hidden rounded border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] ${enabled ? "border-[#ceb895] bg-[#f5e8d3]" : "border-[#d7c3a2] bg-[#f5e8d3]/55"}`}
                                      style={{
                                        backgroundImage:
                                          enabled
                                            ? "linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(0,0,0,0.04) 100%), repeating-linear-gradient(90deg, rgba(120,86,49,0.14) 0 1px, transparent 1px 16px)"
                                            : "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(120,86,49,0.05) 100%), repeating-linear-gradient(90deg, rgba(120,86,49,0.1) 0 1px, transparent 1px 16px)",
                                      }}
                                    >
                                      {samples.length > 0 ? (
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
                                          <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(65,55,38,0.2)" strokeWidth="0.8" />
                                          <polyline
                                            points={waveformPoints(samples)}
                                            fill="none"
                                            stroke={laneStroke}
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      ) : (
                                        <div className="flex h-full items-center px-2 text-[10px] text-[#8b7353]">
                                          {waveformLoadingId === recording.id ? "Loading waveform..." : "Waveform unavailable"}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `${progress}%` }}>
                                  <div className="h-full w-px -translate-x-1/2 bg-[#ef4444]" />
                                </div>
                              </div>

                              <div className="pt-0.5 text-right text-[10px] font-medium text-[#4b5563]">
                                {formatDuration(Math.floor(currentTime))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
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

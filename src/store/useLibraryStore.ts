import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useHarmoniumStore } from "@/store/useHarmoniumStore";
import { useTablaStore } from "@/store/useTablaStore";
import { useTanpuraStore } from "@/store/useTanpuraStore";
import { stopAllNotes, stopDrone } from "@/features/harmonium/engine/audioEngine";
import { stopRhythm } from "@/features/tabla/engine/rhythmEngine";
import { deleteRecordingBlob, loadRecordingBlob } from "@/services/localRecordingStorage";
import type { StarterSessionId } from "@/features/library/data/starterSessions";
import type {
  HarmoniumSessionCard,
  PracticeSession,
  PracticeSessionCard,
  Recording,
  SessionStatus,
  TablaSessionCard,
} from "@/types";

type LibraryFilterMode = "all" | "favorites" | "recent";

interface LibraryState {
  hasHydrated: boolean;
  recordings: Recording[];
  sessions: PracticeSession[];
  selectedSessionId: string | null;
  activeSessionId: string | null;
  focusedCardId: string | null;
  searchQuery: string;
  filterMode: LibraryFilterMode;
  playingId: string | null;

  addRecording: (recording: Recording) => void;
  updateRecording: (id: string, patch: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;
  toggleFavorite: (id: string) => void;

  createSession: () => string;
  createStarterSession: (templateId: StarterSessionId) => string;
  duplicateSession: (id: string) => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string | null) => void;
  focusCard: (cardId: string | null) => void;
  updateSession: (id: string, patch: Partial<PracticeSession>) => void;
  addSessionCard: (sessionId: string, type: PracticeSessionCard["type"]) => void;
  removeSessionCard: (sessionId: string, cardId: string) => void;
  updateSessionCard: (sessionId: string, cardId: string, patch: Partial<PracticeSessionCard>) => void;
  moveSessionCard: (sessionId: string, cardId: string, direction: "up" | "down") => void;
  playSession: (id: string) => void;
  pauseSession: (id: string) => void;
  completeSession: (id: string) => void;

  setSearchQuery: (query: string) => void;
  setFilterMode: (mode: LibraryFilterMode) => void;
  setPlayingId: (id: string | null) => void;
  hydrateRecordingBlobUrls: () => Promise<void>;
}

function createDefaultHarmoniumCard(): HarmoniumSessionCard {
  return {
    id: crypto.randomUUID(),
    type: "harmonium",
    title: "Harmonium Setup",
    enabled: true,
    order: 0,
    config: {
      volume: 0.8,
      sustain: 0.6,
      octave: 4,
      transpose: 0,
      drone: "off",
      rootNote: "C",
      tuningMode: "equal",
      toneMode: "basic",
      bellowsExpression: 0.7,
      autoEnableDrone: false,
    },
  };
}

function createDefaultTablaCard(): TablaSessionCard {
  return {
    id: crypto.randomUUID(),
    type: "tabla",
    title: "Tabla Groove",
    enabled: true,
    order: 1,
    config: {
      taalName: "Teentaal",
      bpm: 80,
      pitch: 0,
      isLooping: true,
      mode: "tabla",
      countInBeats: 0,
      patternLayer: "core",
      stylePackId: null,
      variantId: "core-teentaal-basic",
      thaatContext: null,
      presetSlots: [null, null, null],
      isMetronomeMode: false,
      autoPlay: false,
    },
  };
}

function createDefaultSession(): PracticeSession {
  const now = new Date();
  const harmonium = createDefaultHarmoniumCard();
  const tabla = createDefaultTablaCard();
  tabla.order = 1;

  return {
    id: crypto.randomUUID(),
    uid: "",
    name: "New Session",
    description: "",
    status: "draft",
    cards: [harmonium, tabla],
    lastPlayedAt: null,
    startedAt: now,
    endedAt: now,
    durationMinutes: 20,
    actualPracticeSeconds: 0,
    activePracticeStartedAt: null,
    instrument: "mixed",
    notes: "",
    isTemplate: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createStarterSession(templateId: StarterSessionId): PracticeSession {
  const session = createDefaultSession();
  const harmonium = createDefaultHarmoniumCard();
  const tabla = createDefaultTablaCard();

  if (templateId === "harmonium-warmup") {
    return {
      ...session,
      name: "10-Minute Harmonium Warm-up",
      description: "Open Tanpura for a gentle Sa, then explore the keyboard at your own pace.",
      durationMinutes: 10,
      instrument: "harmonium",
      cards: [{
        ...harmonium,
        title: "Warm up with Sa",
        config: {
          ...harmonium.config,
          drone: "sa",
          toneMode: "warm-reed",
          autoEnableDrone: true,
        },
      }],
    };
  }

  if (templateId === "teentaal-lay") {
    return {
      ...session,
      name: "15-Minute Teentaal Lay Practice",
      description: "Follow the Teentaal cycle at 60 BPM. Keep the pulse steady before increasing speed.",
      durationMinutes: 15,
      instrument: "tabla",
      cards: [{
        ...tabla,
        title: "Teentaal at 60 BPM",
        config: {
          ...tabla.config,
          bpm: 60,
          countInBeats: 4,
          autoPlay: true,
        },
      }],
    };
  }

  return {
    ...session,
    name: "20-Minute Voice & Rhythm",
      description: "Set Tanpura to Sa + Pa, then sing or play with a calm Teentaal pulse at 70 BPM.",
    durationMinutes: 20,
    instrument: "mixed",
    cards: [
      {
        ...harmonium,
        title: "Pitch reference",
        order: 0,
        config: {
          ...harmonium.config,
          drone: "off",
          autoEnableDrone: false,
        },
      },
      {
        ...tabla,
        title: "Teentaal at 70 BPM",
        order: 1,
        config: {
          ...tabla.config,
          bpm: 70,
          countInBeats: 4,
          autoPlay: true,
        },
      },
    ],
  };
}

function normalizeCardOrder(cards: PracticeSessionCard[]) {
  return cards.map((card, index) => ({ ...card, order: index }));
}

function draftStatus(current: SessionStatus): SessionStatus {
  return current === "playing" ? "playing" : "draft";
}

function accumulatedPracticeSeconds(session: PracticeSession, now = new Date()) {
  const savedSeconds = session.actualPracticeSeconds ?? 0;
  if (!session.activePracticeStartedAt) return savedSeconds;
  const startedAt = new Date(session.activePracticeStartedAt).getTime();
  return savedSeconds + Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
}

function stopPracticeAudio() {
  stopAllNotes();
  stopDrone();
  stopRhythm();
  useTanpuraStore.getState().setMode("off");
  useHarmoniumStore.setState({ activeNotes: new Set() });
  useTablaStore.getState().reset();
}

function createSessionCard(type: PracticeSessionCard["type"], order: number): PracticeSessionCard {
  const card = type === "harmonium" ? createDefaultHarmoniumCard() : createDefaultTablaCard();
  return {
    ...card,
    order,
  };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      recordings: [],
      sessions: [],
      selectedSessionId: null,
      activeSessionId: null,
      focusedCardId: null,
      searchQuery: "",
      filterMode: "all",
      playingId: null,

      addRecording: (recording) =>
        set((state) => ({ recordings: [recording, ...state.recordings] })),
      updateRecording: (id, patch) =>
        set((state) => ({
          recordings: state.recordings.map((recording) =>
            recording.id === id ? { ...recording, ...patch } : recording
          ),
        })),
      deleteRecording: (id) =>
        set((state) => {
          const recordingToDelete = state.recordings.find((recording) => recording.id === id);
          if (recordingToDelete?.blobUrl) {
            URL.revokeObjectURL(recordingToDelete.blobUrl);
          }
          if (recordingToDelete?.storageUrl?.startsWith("local:")) {
            void deleteRecordingBlob(recordingToDelete.storageUrl);
          }
          return { recordings: state.recordings.filter((recording) => recording.id !== id) };
        }),
      toggleFavorite: (id) =>
        set((state) => ({
          recordings: state.recordings.map((recording) =>
            recording.id === id
              ? { ...recording, isFavorite: !recording.isFavorite }
              : recording
          ),
        })),

      createSession: () => {
        const session = createDefaultSession();
        set((state) => ({
          sessions: [session, ...state.sessions],
          selectedSessionId: session.id,
          focusedCardId: null,
        }));
        return session.id;
      },

      createStarterSession: (templateId) => {
        const session = createStarterSession(templateId);
        set((state) => ({
          sessions: [session, ...state.sessions],
          selectedSessionId: session.id,
          focusedCardId: session.cards[0]?.id ?? null,
        }));
        return session.id;
      },

      duplicateSession: (id) =>
        set((state) => {
          const source = state.sessions.find((session) => session.id === id);
          if (!source) return state;

          const now = new Date();
          const copy: PracticeSession = {
            ...source,
            id: crypto.randomUUID(),
            name: `${source.name} Copy`,
            status: "draft",
            lastPlayedAt: null,
            createdAt: now,
            updatedAt: now,
            cards: source.cards.map((card, index) => ({
              ...card,
              id: crypto.randomUUID(),
              order: index,
            })),
          };

          return {
            sessions: [copy, ...state.sessions],
            selectedSessionId: copy.id,
            focusedCardId: copy.cards[0]?.id ?? null,
          };
        }),

      deleteSession: (id) =>
        set((state) => {
          if (state.activeSessionId === id) {
            stopPracticeAudio();
          }
          const nextSessions = state.sessions.filter((session) => session.id !== id);
          const nextSelected =
            state.selectedSessionId === id ? nextSessions[0]?.id ?? null : state.selectedSessionId;
          const nextActive = state.activeSessionId === id ? null : state.activeSessionId;

          return {
            sessions: nextSessions,
            selectedSessionId: nextSelected,
            activeSessionId: nextActive,
            focusedCardId: state.focusedCardId,
          };
        }),

      selectSession: (id) =>
        set((state) => ({
          selectedSessionId: id,
          focusedCardId: id
            ? [...(state.sessions.find((session) => session.id === id)?.cards ?? [])].sort((a, b) => a.order - b.order)[0]?.id ?? null
            : null,
        })),

      focusCard: (cardId) => set({ focusedCardId: cardId }),

      updateSession: (id, patch) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? { ...session, ...patch, updatedAt: new Date() }
              : session
          ),
        })),

      addSessionCard: (sessionId, type) =>
        set((state) => {
          let nextFocusedCardId = state.focusedCardId;
          const nextSessions = state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const existingCard = session.cards.find((card) => card.type === type);
            if (existingCard) {
              nextFocusedCardId = existingCard.id;
              return {
                ...session,
                cards: session.cards.map((card) =>
                  card.id === existingCard.id
                    ? ({ ...card, enabled: true } as PracticeSessionCard)
                    : card
                ),
                updatedAt: new Date(),
              };
            }

            const card = createSessionCard(type, session.cards.length);
            nextFocusedCardId = card.id;

            return {
              ...session,
              status: draftStatus(session.status),
              cards: [...session.cards, card],
              updatedAt: new Date(),
            };
          });

          return {
            focusedCardId: nextFocusedCardId,
            sessions: nextSessions,
          };
        }),

      removeSessionCard: (sessionId, cardId) =>
        {
          const session = get().sessions.find((entry) => entry.id === sessionId);
          const removedCard = session?.cards.find((card) => card.id === cardId);
          const stillHasEnabledOfType = session
            ? session.cards.some((card) => card.id !== cardId && card.type === removedCard?.type && card.enabled)
            : false;

          if (removedCard?.type === "harmonium" && !stillHasEnabledOfType) {
            useHarmoniumStore.getState().setDrone("off");
          }
          if (removedCard?.type === "tabla" && !stillHasEnabledOfType) {
            useTablaStore.getState().setPlaying(false);
            useTablaStore.getState().reset();
          }

          set((state) => {
            let nextFocusedCardId = state.focusedCardId;
            const nextSessions = state.sessions.map((sessionEntry) => {
              if (sessionEntry.id !== sessionId) return sessionEntry;

              const nextCards = normalizeCardOrder(sessionEntry.cards.filter((card) => card.id !== cardId));
              if (state.focusedCardId === cardId) {
                nextFocusedCardId = nextCards[0]?.id ?? null;
              }

              return {
                ...sessionEntry,
                status: draftStatus(sessionEntry.status),
                cards: nextCards,
                updatedAt: new Date(),
              };
            });

            return {
              focusedCardId: nextFocusedCardId,
              sessions: nextSessions,
            };
          });
        },

      updateSessionCard: (sessionId, cardId, patch) =>
        {
          const session = get().sessions.find((entry) => entry.id === sessionId);
          const currentCard = session?.cards.find((card) => card.id === cardId);
          const disablesCard = patch.enabled === false && currentCard?.enabled;

          if (disablesCard && currentCard?.type === "harmonium") {
            const hasOtherEnabled = session
              ? session.cards.some((card) => card.id !== cardId && card.type === "harmonium" && card.enabled)
              : false;
            if (!hasOtherEnabled) {
              useHarmoniumStore.getState().setDrone("off");
            }
          }

          if (disablesCard && currentCard?.type === "tabla") {
            const hasOtherEnabled = session
              ? session.cards.some((card) => card.id !== cardId && card.type === "tabla" && card.enabled)
              : false;
            if (!hasOtherEnabled) {
              useTablaStore.getState().setPlaying(false);
              useTablaStore.getState().reset();
            }
          }

          set((state) => ({
            sessions: state.sessions.map((sessionEntry) => {
              if (sessionEntry.id !== sessionId) return sessionEntry;

              const cards = sessionEntry.cards.map((card) =>
                card.id === cardId ? ({ ...card, ...patch } as PracticeSessionCard) : card
              );

              return {
                ...sessionEntry,
                status: draftStatus(sessionEntry.status),
                cards,
                updatedAt: new Date(),
              };
            }),
          }));
        },

      moveSessionCard: (sessionId, cardId, direction) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const sorted = [...session.cards].sort((left, right) => left.order - right.order);
            const currentIndex = sorted.findIndex((card) => card.id === cardId);
            if (currentIndex === -1) return session;

            const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= sorted.length) return session;

            const nextCards = [...sorted];
            [nextCards[currentIndex], nextCards[targetIndex]] = [nextCards[targetIndex], nextCards[currentIndex]];

            return {
              ...session,
              cards: normalizeCardOrder(nextCards),
              status: draftStatus(session.status),
              updatedAt: new Date(),
            };
          }),
        })),

      playSession: (id) => {
        const session = get().sessions.find((entry) => entry.id === id);
        if (!session || !session.cards.some((card) => card.enabled)) return;
        const now = new Date();

        const harmoniumCard = session.cards
          .filter((card): card is HarmoniumSessionCard => card.type === "harmonium")
          .find((card) => card.enabled);
        const tablaCard = session.cards
          .filter((card): card is TablaSessionCard => card.type === "tabla")
          .find((card) => card.enabled);

        if (harmoniumCard) {
          useHarmoniumStore.getState().applyConfig(harmoniumCard.config);
        }

        if (tablaCard) {
          useTablaStore.getState().applyConfig(tablaCard.config);
          useTablaStore.getState().setPlaying(tablaCard.config.autoPlay);
        } else {
          useTablaStore.getState().reset();
        }

        set((state) => ({
          activeSessionId: id,
          selectedSessionId: id,
          focusedCardId: harmoniumCard?.id ?? tablaCard?.id ?? null,
          sessions: state.sessions.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status: "playing",
                  activePracticeStartedAt: entry.activePracticeStartedAt ?? now,
                  lastPlayedAt: now,
                  updatedAt: now,
                }
              : entry.id === state.activeSessionId
              ? {
                  ...entry,
                  status: entry.status === "playing" ? "saved" : entry.status,
                  actualPracticeSeconds: accumulatedPracticeSeconds(entry, now),
                  activePracticeStartedAt: null,
                  updatedAt: now,
                }
              : entry
          ),
        }));
      },

      pauseSession: (id) => {
        if (get().activeSessionId === id) {
          stopPracticeAudio();
        }
        const now = new Date();
        set((state) => ({
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  status: "paused",
                  actualPracticeSeconds: accumulatedPracticeSeconds(session, now),
                  activePracticeStartedAt: null,
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      completeSession: (id) => {
        if (get().activeSessionId === id) {
          stopPracticeAudio();
        }
        const now = new Date();
        set((state) => ({
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  status: "completed",
                  actualPracticeSeconds: accumulatedPracticeSeconds(session, now),
                  activePracticeStartedAt: null,
                  endedAt: now,
                  updatedAt: now,
                }
              : session
          ),
        }));
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilterMode: (mode) => set({ filterMode: mode }),
      setPlayingId: (id) => set({ playingId: id }),
      hydrateRecordingBlobUrls: async () => {
        const localRecordings = get().recordings.filter((recording) => recording.storageUrl?.startsWith("local:"));

        for (const recording of localRecordings) {
          if (!recording.storageUrl) continue;

          try {
            const blob = await loadRecordingBlob(recording.storageUrl);
            if (!blob) continue;
            const nextBlobUrl = URL.createObjectURL(blob);

            set((state) => {
              const current = state.recordings.find((entry) => entry.id === recording.id);
              if (!current) {
                URL.revokeObjectURL(nextBlobUrl);
                return state;
              }
              if (current.blobUrl && current.blobUrl !== nextBlobUrl) {
                URL.revokeObjectURL(current.blobUrl);
              }

              return {
                recordings: state.recordings.map((entry) =>
                  entry.id === recording.id
                    ? { ...entry, blobUrl: nextBlobUrl }
                    : entry
                ),
              };
            });
          } catch {
            // Ignore local blob hydration failures for individual recordings.
          }
        }
      },
    }),
    {
      name: "library-store",
      partialize: (state) => ({
        recordings: state.recordings,
        sessions: state.sessions,
        selectedSessionId: state.selectedSessionId,
        focusedCardId: state.focusedCardId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hasHydrated = true;
        state.activeSessionId = null;
        if (!state.selectedSessionId) {
          state.selectedSessionId = state.sessions[0]?.id ?? null;
        }
        if (!state.focusedCardId) {
          state.focusedCardId = [...(state.sessions[0]?.cards ?? [])].sort((a, b) => a.order - b.order)[0]?.id ?? null;
        }
      },
    }
  )
);

// ─── User & Auth ───────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export interface UserSettings {
  uid: string;
  theme: "dark" | "light" | "system";
  defaultBPM: number;          // 40–240
  defaultOctave: number;       // 3 | 4 | 5
  defaultVolume: number;       // 0–1
  defaultDrone: "off" | "sa" | "pa" | "sa+pa";
  audioLatencyHint: "interactive" | "balanced" | "playback";
  updatedAt: Date;
}

// ─── Recordings ────────────────────────────────────────────────────────────────

export type SessionInstrument = "harmonium" | "tabla" | "tanpura" | "flute";

export interface Recording {
  id: string;
  uid: string;
  name: string;
  durationSeconds: number;
  createdAt: Date;
  storageUrl: string | null;  // Firebase Storage path
  isFavorite: boolean;
  notes: string;
  tags: string[];
  instrument: "harmonium" | "tabla" | "other";
  blobUrl?: string;            // local-only, transient
  stemStorageUrls?: Partial<Record<SessionInstrument, string>>;
  stemBlobUrls?: Partial<Record<SessionInstrument, string>>;
  capturedInstruments?: SessionInstrument[];
  instrumentActivitySeconds?: Partial<Record<SessionInstrument, number>>;
}

// ─── Practice Sessions ─────────────────────────────────────────────────────────

export type SessionStatus = "draft" | "saved" | "playing" | "paused" | "completed";

export interface HarmoniumSessionConfig {
  volume: number;
  sustain: number;
  octave: number;
  transpose: number;
  drone: DroneMode;
  rootNote: RootNote;
  tuningMode: HarmoniumTuningMode;
  toneMode: HarmoniumToneMode;
  bellowsExpression: number;
  autoEnableDrone: boolean;
}

export interface TablaSessionConfig {
  taalName: TaalName;
  bpm: number;
  pitch: number;
  isLooping: boolean;
  mode: "tabla" | "metronome";
  countInBeats: 0 | 2 | 4 | 8;
  patternLayer: "core" | "style-pack";
  stylePackId: string | null;
  variantId: string;
  thaatContext: ThaatName | null;
  presetSlots: [TablaPresetSlot | null, TablaPresetSlot | null, TablaPresetSlot | null];
  isMetronomeMode: boolean;
  autoPlay: boolean;
}

export interface TablaPresetSlot {
  name: string;
  taalName: TaalName;
  bpm: number;
  pitch: number;
  isLooping: boolean;
  mode: "tabla" | "metronome";
  countInBeats: 0 | 2 | 4 | 8;
  patternLayer: "core" | "style-pack";
  stylePackId: string | null;
  variantId: string;
  thaatContext: ThaatName | null;
}

export interface SessionCardBase {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface HarmoniumSessionCard extends SessionCardBase {
  type: "harmonium";
  config: HarmoniumSessionConfig;
}

export interface TablaSessionCard extends SessionCardBase {
  type: "tabla";
  config: TablaSessionConfig;
}

export type PracticeSessionCard = HarmoniumSessionCard | TablaSessionCard;

export interface PracticeSession {
  id: string;
  uid: string;
  name: string;
  description: string;
  status: SessionStatus;
  cards: PracticeSessionCard[];
  lastPlayedAt: Date | null;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  actualPracticeSeconds: number;
  activePracticeStartedAt: Date | null;
  instrument: "harmonium" | "tabla" | "mixed";
  notes: string;
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Favorites ─────────────────────────────────────────────────────────────────

export interface Favorite {
  id: string;
  uid: string;
  type: "taal" | "recording" | "preset";
  refId: string;
  name: string;
  createdAt: Date;
}

// ─── Taal / Rhythm ─────────────────────────────────────────────────────────────

export type TaalName = string;

export type ThaatName =
  | "Bilawal"
  | "Khamaj"
  | "Kafi"
  | "Asavari"
  | "Bhairav"
  | "Bhairavi"
  | "Todi"
  | "Marwa"
  | "Poorvi"
  | "Kalyan";

export interface Beat {
  index: number;           // beat position within cycle
  vibhag: number;          // section index
  isSam: boolean;          // first beat of cycle
  isKhali: boolean;        // empty/silent wave beat
  syllable: string;        // e.g. "Dha", "Dhin", "Ti"
  accent: "strong" | "medium" | "weak";
}

export interface Taal {
  name: TaalName;
  beats: number;           // total beats per cycle
  vibhags: number[];       // beat counts per vibhag e.g. [4,4,4] for Teentaal
  pattern: Beat[];
  description: string;
}

export interface TaalPatternVariant {
  id: string;
  name: string;
  level: "basic" | "medium" | "advanced";
  kind: "theka" | "fill" | "rela" | "kaida";
  description: string;
  pattern: Beat[];
}

export interface TaalStylePack {
  id: string;
  name: string;
  description: string;
  taalName: TaalName;
  source: "gharana" | "genre" | "speed";
  variants: TaalPatternVariant[];
}

// ─── Harmonium ─────────────────────────────────────────────────────────────────

export interface HarmoniumKey {
  note: string;           // e.g. "C4"
  label: string;          // display name Sa, Re, Ga ...
  isBlack: boolean;
  octave: number;
  semitone: number;       // 0–11
}

export type DroneMode = "off" | "sa" | "pa" | "sa+pa";
export type RootNote = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
export type HarmoniumTuningMode = "equal" | "natural";
export type HarmoniumToneMode = "basic" | "warm-reed";

// ─── Stats ─────────────────────────────────────────────────────────────────────

export interface UserStats {
  practiceMinutes: number;
  totalSessions: number;
  recordingsCount: number;
  favoriteTaals: string[];
}

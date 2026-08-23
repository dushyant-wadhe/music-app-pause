import type { HarmoniumKey } from "@/types";

// Indian note names mapped to Western (Sa = C)
const SARGAM: Record<number, string> = {
  0:  "Sa",
  1:  "Re♭",
  2:  "Re",
  3:  "Ga♭",
  4:  "Ga",
  5:  "Ma",
  6:  "Ma#",
  7:  "Pa",
  8:  "Dha♭",
  9:  "Dha",
  10: "Ni♭",
  11: "Ni",
};

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

// Must be declared before generateKeys so it's in scope when the function runs
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;

/**
 * Generate harmonium keys for a given range of octaves.
 * Default: C3 → C6 (3 full octaves + top C = 37 keys)
 */
export function generateKeys(startOctave = 3, octaveCount = 3): HarmoniumKey[] {
  const keys: HarmoniumKey[] = [];
  const safeStart = Math.max(1, Math.min(startOctave, 6));

  for (let oct = safeStart; oct < safeStart + octaveCount; oct++) {
    for (let semi = 0; semi < 12; semi++) {
      keys.push({
        note:    `${NOTE_NAMES[semi]}${oct}`,
        label:   SARGAM[semi],
        isBlack: BLACK_SEMITONES.has(semi),
        octave:  oct,
        semitone: semi,
      });
    }
  }
  // Top C (Sa of next octave)
  const topOct = safeStart + octaveCount;
  keys.push({
    note:    `C${topOct}`,
    label:   "Sa",
    isBlack: false,
    octave:  topOct,
    semitone: 0,
  });
  return keys;
}

export function generateFull88Keys(): HarmoniumKey[] {
  const keys: HarmoniumKey[] = [];
  
  // Octave 0: A0 to B0
  keys.push({ note: "A0", label: SARGAM[9], isBlack: false, octave: 0, semitone: 9 });
  keys.push({ note: "A#0", label: SARGAM[10], isBlack: true, octave: 0, semitone: 10 });
  keys.push({ note: "B0", label: SARGAM[11], isBlack: false, octave: 0, semitone: 11 });

  // Octaves 1 to 7
  for (let oct = 1; oct <= 7; oct++) {
    for (let semi = 0; semi < 12; semi++) {
      keys.push({
        note:    `${NOTE_NAMES[semi]}${oct}`,
        label:   SARGAM[semi],
        isBlack: BLACK_SEMITONES.has(semi),
        octave:  oct,
        semitone: semi,
      });
    }
  }

  // C8 (top note)
  keys.push({
    note:    "C8",
    label:   "Sa",
    isBlack: false,
    octave:  8,
    semitone: 0,
  });

  return keys;
}

/** Keyboard shortcut → semitone offset within current octave */
export const KEY_MAP: Record<string, number> = {
  // White keys
  "a": 0,   // Sa  (C)
  "s": 2,   // Re  (D)
  "d": 4,   // Ga  (E)
  "f": 5,   // Ma  (F)
  "g": 7,   // Pa  (G)
  "h": 9,   // Dha (A)
  "j": 11,  // Ni  (B)
  "k": 12,  // Sa' (C, next octave)
  // Black keys
  "w": 1,   // Re♭ (C#)
  "e": 3,   // Ga♭ (D#)
  "t": 6,   // Ma# (F#)
  "y": 8,   // Dha♭(G#)
  "u": 10,  // Ni♭ (A#)
};


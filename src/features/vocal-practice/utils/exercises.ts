/**
 * Vocal Practice — Exercise Definitions
 * Sargam and alankar exercises for riyaaz.
 */

export interface SwaraNote {
  label: string;    // "Sa", "Re", etc.
  degree: number;   // semitone degree relative to root (0=Sa, 2=Re, 4=Ga …)
  octaveOffset?: number; // 0 (default) or 1 for upper octave
}

export interface Exercise {
  id: string;
  name: string;
  nameHindi?: string;
  description: string;
  notes: SwaraNote[];
  tempoBpm: number;
  category: "aaroha" | "avaroha" | "alankar" | "raga";
}

export const EXERCISES: Exercise[] = [
  {
    id: "aaroha",
    name: "Aaroha",
    nameHindi: "आरोह",
    description: "Ascending scale — Sa to upper Sa",
    tempoBpm: 60,
    category: "aaroha",
    notes: [
      { label: "Sa",  degree: 0 },
      { label: "Re",  degree: 2 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Ṡa",  degree: 0, octaveOffset: 1 },
    ],
  },
  {
    id: "avaroha",
    name: "Avaroha",
    nameHindi: "अवरोह",
    description: "Descending scale — upper Sa to Sa",
    tempoBpm: 60,
    category: "avaroha",
    notes: [
      { label: "Ṡa",  degree: 0, octaveOffset: 1 },
      { label: "Ni",  degree: 11 },
      { label: "Dha", degree: 9 },
      { label: "Pa",  degree: 7 },
      { label: "Ma",  degree: 5 },
      { label: "Ga",  degree: 4 },
      { label: "Re",  degree: 2 },
      { label: "Sa",  degree: 0 },
    ],
  },
  {
    id: "saregama",
    name: "Sa Re Ga Ma",
    description: "Lower tetrachord — foundation of the scale",
    tempoBpm: 72,
    category: "aaroha",
    notes: [
      { label: "Sa", degree: 0 },
      { label: "Re", degree: 2 },
      { label: "Ga", degree: 4 },
      { label: "Ma", degree: 5 },
    ],
  },
  {
    id: "padhani",
    name: "Pa Dha Ni Ṡa",
    description: "Upper tetrachord — builds on the lower tetrachord",
    tempoBpm: 72,
    category: "aaroha",
    notes: [
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Ṡa",  degree: 0, octaveOffset: 1 },
    ],
  },
  {
    id: "alankar1",
    name: "Alankar 1",
    nameHindi: "अलंकार",
    description: "S R G — R G M — G M P — M P D — P D N — D N Ṡ",
    tempoBpm: 80,
    category: "alankar",
    notes: [
      { label: "Sa",  degree: 0 },
      { label: "Re",  degree: 2 },
      { label: "Ga",  degree: 4 },
      { label: "Re",  degree: 2 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Ṡa",  degree: 0, octaveOffset: 1 },
    ],
  },
  {
    id: "alankar2",
    name: "Alankar 2",
    description: "S R G M — R G M P — G M P D — M P D N — P D N Ṡ",
    tempoBpm: 76,
    category: "alankar",
    notes: [
      { label: "Sa",  degree: 0 },
      { label: "Re",  degree: 2 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Re",  degree: 2 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Ga",  degree: 4 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ma",  degree: 5 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Pa",  degree: 7 },
      { label: "Dha", degree: 9 },
      { label: "Ni",  degree: 11 },
      { label: "Ṡa",  degree: 0, octaveOffset: 1 },
    ],
  },
];

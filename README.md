# Riyaaz

Riyaaz is a browser-based practice companion for Indian classical, devotional, and light-music learners. It combines a playable harmonium, a tabla/metronome engine, saved practice sessions, and local recording so a learner can practise from one calm workspace.

## Current capabilities

- **Harmonium:** touch and computer-keyboard input, sargam display, octave/transpose, root Sa, drone, tuning/tone options, bellows expression, and recording.
- **Tabla:** Teentaal, Dadra, Keharwa, Rupak, and Ektaal; beat variants and style packs; BPM, pitch, looping, count-in, presets, metronome mode, and beat visualisation.
- **Sessions:** create a practice session, attach harmonium/tabla cards, configure each card, reorder them, and track draft/playing/paused/completed state.
- **Library and profile:** locally saved sessions/recordings, favourites, practice summary, and default instrument settings.

## Technology

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 with a small global style layer
- Zustand with browser persistence for product state
- Web Audio API and MediaRecorder for synthesis, rhythm, and recording
- Firebase Auth and Firestore helpers are present as scaffolding; cloud sync is not currently an end-to-end product flow.

## Run locally

Riyaaz uses Next.js 16, which requires **Node.js 20.9 or later**.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page and quick start entry point. |
| `/sessions` | Saved practice sessions; create or reopen a session. |
| `/session/[id]` | Configure and run a session's harmonium/tabla cards. |
| `/harmonium` | Standalone harmonium and recording workspace. |
| `/tanpura` | Global tonal foundation: Sa or Sa + Pa, root, octave, and volume. |
| `/tabla` | Standalone tabla/metronome workspace. |
| `/profile` | Local settings, practice totals, recordings, and sign-in entry point. |
| `/library` | Redirects to `/sessions` for backwards compatibility. |

## Project map

```text
src/app/                  Routes, root layout, global CSS
src/components/           Shared layout and UI primitives
src/features/harmonium/   Keyboard, controls, Web Audio synthesis, recording
src/features/tabla/       Taal data, rhythm engine, controls, visualiser
src/features/library/     Session list, session editor, recordings
src/features/profile/     Profile and default settings
src/store/                Persisted Zustand state
src/services/             Firebase app, authentication, Firestore helpers
src/types/                Shared domain types
```

## Persistence and data

Sessions, instrument settings, recordings metadata, and profile preferences are persisted in the browser using Zustand. Recording audio is represented by browser blob URLs, so its retention and portability depend on browser storage/session behaviour.

Firebase environment variables are only needed when completing the Google sign-in and Firestore-sync flow:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Do not present cloud sync as available until authentication, Firestore security rules, migrations, conflict handling, and recording-storage behaviour are implemented and tested.

## Audio and browser notes

- Audio starts only after a user interaction, as required by browsers.
- Verify harmonium, tabla, drone, and recording in Chrome and Safari before release; timing and MediaRecorder support can vary by browser/device.
- Use the manual checklist in [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md) for each release.

## Product direction

The next product priority is a low-friction first practice: a guided onboarding flow, useful starter sessions, simple primary controls, and explicit session playback. The complete prioritised plan is in [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md).

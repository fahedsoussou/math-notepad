# Math Notepad — Project Memory

Read this file at the start of every future session on this project. It is
the single source of truth for what this app is, how it's built, and what
rules must never be broken.

## Goal

A personal handwriting math notepad web app (PWA), built for Fahed's Samsung
Galaxy Tab S8 Ultra with S Pen, used in Chrome and installed to the home
screen. Think "MyScript Math but better": step-by-step solutions, university
and engineering-level math, an electrical engineering mode, full offline
support, and an optional free Gemini AI assist when online. UI language is
English.

The owner (Fahed) is not a programmer. Every future session should explain
things in plain language, work in small steps, and wait for confirmation
before anything that needs him to act (installing something, giving a
credential, approving a GitHub step, testing on the tablet, etc.).

## Stack

- **Build**: Vite + TypeScript + React
- **PWA**: vite-plugin-pwa (manifest + service worker, offline-capable, installable)
- **Ink input**: perfect-freehand (pressure-sensitive strokes), low-latency
  canvas (`desynchronized: true`), S Pen only draws — fingers are ignored so
  touch can later be used for scroll/pan/palm rejection
- **Display math**: KaTeX (fast, read-only rendering)
- **Editable math / corrections**: MathLive
- **Math engine**: Pyodide + SymPy + Pint, running inside a Web Worker (so
  heavy computation never freezes the UI)
- **Handwriting recognition (offline, later phase)**: ONNX Runtime Web with
  the CoMER model
- **AI assist (optional, online only)**: Gemini API free tier, used as a
  fallback/enhancement — never required for core offline functionality
- **Graphing**: function-plot
- **PDF import/export**: pdf.js (reading/rendering) + pdf-lib (writing)
- **Storage**: Dexie (IndexedDB wrapper) + OPFS for larger binary data
  (PDFs, images); must survive app updates
- **Hosting**: GitHub Pages, deployed via GitHub Actions on every push to
  `main`

> Note: only `perfect-freehand` and `vite-plugin-pwa` are installed as of
> Phase 0. The rest are added when the phase that needs them starts, to keep
> the project simple and avoid unused dependencies sitting around.

## Folder structure (set up in Phase 0, filled in later)

```
src/
  canvas/         — ink canvas, stroke capture, rendering
  recognition/    — handwriting → math/text recognition (ONNX/CoMER later)
  math-engine/    — Pyodide/SymPy worker, solving, differentiation, etc.
  storage/        — Dexie/IndexedDB + OPFS data layer
  library/        — folders > notebooks > pages data model and UI
  pages/          — top-level app screens/routes (includes PenTestPage.tsx)
```

## Must-haves

- Greek letters available in input/recognition
- Library structure: **folders (per subject) > notebooks > pages**
- PDF and image import
- Export to PDF, PNG, and LaTeX
- Full library backup (export everything, restore from backup)

## Interaction model (triggers)

- Writing `=` at the end of an expression **solves it**.
- An expression written *without* `=` shows a small fading chip of suggested
  actions: **Plot, Differentiate, Integrate, Simplify, Solve**.
- Handwritten math commands act directly when recognized: `plot`, `d/dx`,
  `solve`, `lim`, `factor`, etc.
- Circling a written expression opens an action menu for it.
- Anything recognized as non-math stays as plain ink (not touched/converted).
- A settings toggle switches between **Suggest mode** (chips/menus appear)
  and **Quiet mode** (no automatic suggestions, fully manual).

## Roadmap

0. **Setup** — project scaffold, PWA shell, pen test page, GitHub Pages
   deploy pipeline. *(this phase)*
1. **Write and solve (MVP)** — real ink canvas, basic recognition, `=`
   triggers a solve via the math engine.
2. **Offline recognition** — ONNX Runtime Web + CoMER model running fully
   on-device, no network needed.
3. **Step-by-step** — solutions show intermediate steps, not just answers.
4. **Graphs + PDF** — function-plot integration, PDF/image import and
   PDF/PNG/LaTeX export.
5. **Electrical engineering mode** — units via Pint, phasors, circuit-style
   notation/helpers.
6. **Advanced math** — series, statistics, matrices, ODEs, Laplace
   transforms.
7. **Polish + personal handwriting model** — tuning recognition to Fahed's
   own handwriting, general UX polish.

## Rules (never break these)

1. **Never store the Gemini API key in code or in the git repo.** It is
   entered by the user on-device only (e.g. typed into a settings field and
   kept in local storage/IndexedDB on that device), never committed,
   never hardcoded, never put in a `.env` file that gets committed.
2. **App updates must never delete user notes.** Any change to the storage
   schema needs a migration path that preserves existing data. Test this
   before shipping a storage-affecting change.
3. **Work in small, tested steps.** Don't bundle unrelated changes together.
4. **Commit after each working step**, with a clear message of what changed
   and why.

## Current status (Phase 0)

- Vite + React + TypeScript project scaffolded at the repo root.
- `vite-plugin-pwa` configured: manifest (name "Math Notepad", short name
  "MathPad", landscape, standalone display) + service worker for offline use.
- Icons generated from `public/favicon.svg` into the PWA PNG sizes.
- Folder structure above created with placeholder `.gitkeep` files.
- `src/pages/PenTestPage.tsx` is the entire app for now: a full-screen,
  low-latency canvas that draws smooth pressure-sensitive strokes for
  `pointerType === 'pen'` (and mouse, for laptop testing), ignores
  `pointerType === 'touch'`, has a Clear button, and shows a pen
  events/second counter.
- GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and
  deploys to GitHub Pages on every push to `main`.
- `vite.config.ts` sets `base: '/math-notepad/'` to match the GitHub Pages
  repo path (`https://<username>.github.io/math-notepad/`).

## What Phase 1 will need

- Replace `PenTestPage` with the real ink canvas (`src/canvas/`), capable of
  holding many strokes, not just one at a time, with pan/zoom.
- A basic recognition step (even a simple/placeholder one at first) to turn
  strokes into a math expression string.
- Wire up Pyodide + SymPy in a Web Worker (`src/math-engine/`) so typing/
  writing `expr =` returns a solved result.
- Start the Dexie storage layer (`src/storage/`) so pages persist across
  reloads — this is also when Rule 2 (never delete user notes) starts to
  matter in practice.
- Basic library navigation (`src/library/`): at least one notebook/page,
  even before folders exist.

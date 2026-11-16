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

## Phase 0 history (DONE ✅)

- Vite + React + TypeScript project scaffolded at the repo root.
- `vite-plugin-pwa` configured: manifest (name "Math Notepad", short name
  "MathPad", standalone display) + service worker for offline use.
  (Not forcing `orientation: 'landscape'` — see gotcha below.)
- Icons generated from `public/favicon.svg` into the PWA PNG sizes.
- Folder structure above created with placeholder `.gitkeep` files.
- `src/pages/PenTestPage.tsx` is the entire app for now: a full-screen
  canvas that draws smooth pressure-sensitive strokes for
  `pointerType === 'pen'` (and mouse, for laptop testing), ignores
  `pointerType === 'touch'`, has a Clear button, and shows a pen
  events/second counter.
- GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and
  deploys to GitHub Pages on every push to `main`.
- `vite.config.ts` sets `base: '/math-notepad/'` to match the GitHub Pages
  repo path (`https://<username>.github.io/math-notepad/`).
- **Verified on the actual Galaxy Tab S8 Ultra**: installs from the GitHub
  Pages link, opens offline (airplane mode tested), and the S Pen draws
  accurately and smoothly.

### Gotchas hit and fixed in Phase 0 (useful for Phase 1's real canvas)

1. **Black canvas on first touch.** A `<canvas>` context created with
   `{ desynchronized: true }` rendered solid black instead of transparent
   on this device/Chrome combo until explicitly painted. Fix: don't rely on
   canvas transparency — always paint an explicit background color after
   every resize/clear, and avoid `desynchronized: true` unless proven
   necessary later.
2. **`<canvas>` needs an explicit CSS size.** `<canvas>` is a "replaced
   element" — `position: absolute; inset: 0` alone does NOT stretch it to
   fill its container the way it does a `<div>`. Without an explicit CSS
   `width`/`height` (e.g. `100%`), it renders at its *intrinsic* size, which
   for a canvas is its `width`/`height` **attributes** (the physical
   drawing-buffer resolution set in JS, e.g. `window.innerWidth * dpr`).
   That made the canvas render ~2x too big and get clipped by the viewport,
   so touch position and drawn ink disagreed more the further from the
   top-left corner you drew. **Always set explicit CSS width/height on any
   canvas**, separate from its drawing-buffer resolution.
3. A small lag between the raw pointer position and the rendered ink tip is
   expected — `perfect-freehand`'s `streamline`/`smoothing` options trade
   responsiveness for smoother curves. Tune those values, don't "fix" this
   as if it were a bug.

## Current status (Phase 1A — in progress 🚧)

Phase 1A is "the notepad and the library", built in small steps. Step 1
(Library) is done; the ink canvas, symbol palette, settings screen, and
backup are not started yet.

### Step 1 — Library: DONE ✅

- `src/storage/db.ts`: Dexie (IndexedDB) schema — `folders`, `notebooks`,
  `pages` tables. Deletion is **soft** (`deletedAt` timestamp, not row
  removal) so Trash can restore anything; "Empty Trash" is the only
  permanent delete, and it requires an in-app confirm. CRUD + trash/restore/
  duplicate/move helper functions live here (`createFolder`, `trashNotebook`,
  `duplicatePage`, `emptyTrash`, etc.) — screens call these, they never talk
  to Dexie directly.
- `src/storage/persist.ts`: calls `navigator.storage.persist()` once on
  app start (best-effort; some browsers auto-grant, some refuse — either way
  is fine, nothing depends on it synchronously).
- `src/library/`: the whole library UI, state-based navigation (no router —
  nav is shallow: home → folder → notebook → page, plus a trash screen).
  - `LibraryApp.tsx` — top-level screen switch, owns the current route.
  - `HomeScreen.tsx` — folder grid + colour dot, "Recent notebooks" (last
    8 by `lastOpenedAt`), Trash button with a live count, "+ Folder", and a
    "+ Quick notebook" escape hatch that doesn't require making a folder
    first (auto-creates/reuses an "Unfiled" folder).
  - `FolderScreen.tsx` — notebooks in a folder; rename/recolour/delete the
    folder itself; per-notebook rename/duplicate/move-to-another-folder/
    delete via an inline "⋯ Options" menu.
  - `NotebookScreen.tsx` — pages in a notebook (ordered by `order`, not
    creation time); rename/duplicate/delete per page; opening a notebook
    stamps `lastOpenedAt` for the Recent list.
  - `TrashScreen.tsx` — restore any folder/notebook/page, or "Empty Trash"
    (native `confirm()`, irreversible).
  - `NewFolderDialog.tsx` — name + colour-swatch picker (9 preset colours
    in `colors.ts`), used for both create and edit.
  - `PagePlaceholder.tsx` — **temporary** stand-in for a page's content.
    Opening a page currently just shows its id and a "canvas comes next"
    message. This exists only so library navigation (create/open/rename/
    delete pages) could be tested before the real ink canvas exists; it
    gets replaced wholesale by Step 2, not extended.
- Renames/deletes/moves use native `window.prompt()` / `window.confirm()`
  for text input and yes/no — deliberately low-effort for Phase 1A Step 1;
  revisit with proper in-app dialogs during polish (Phase 7) if they feel
  bad on the tablet.
- **Known limitation**: if a notebook/page is restored from Trash while its
  parent folder/notebook is still in Trash, it becomes orphaned (not
  reachable from Home, though it may still show under "Recent"). Restoring
  a whole folder cascades correctly; restoring a child alone does not
  re-parent it. Not fixed yet — low priority, flag if it's confusing on the
  tablet.
- Not yet verified on the actual tablet — needs that pass before Step 1 is
  fully "done".

### What Step 2 (infinite canvas page) will need

- Replace `PagePlaceholder` with the real ink canvas in `src/canvas/`,
  reusing the Phase 0 pen-drawing logic from `PenTestPage.tsx`
  (`perfect-freehand`, explicit canvas background paint, explicit CSS
  width/height — see the Phase 0 gotchas below, they still apply).
  `PenTestPage.tsx` itself is unused dead code now; fine to delete once the
  real canvas lands.
- Pan with one or two fingers, pinch-zoom, S Pen still draws-only, palm
  ignored — all on top of the existing pointerType filtering.
- Strokes need a vector data model (points, pressure, time) saved per page
  in a new Dexie table (not yet added — pages currently have no content
  field at all), so Step 2 is also a storage schema change: needs a Dexie
  version bump + migration, per Rule 2.
- Tools: pen (colour/thickness), highlighter, stroke eraser, scratch-out
  gesture, lasso select (move/copy/delete), undo/redo.
- Page backgrounds (blank/lined/grid/dotted) — probably a field on `Page`.
- Autosave that can't lag drawing — likely debounced writes off the render
  path, same spirit as the math-engine Web Worker plan for Phase 1B.

### What's still after that in Phase 1A

- Symbol palette (Greek letters + operators), Settings screen (Gemini key
  field, Suggest/Quiet toggle, dark mode — stored but unused until Phase
  1B), and full-library backup export/import.

## What Phase 1 will need

- A basic recognition step (even a simple/placeholder one at first) to turn
  strokes into a math expression string.
- Wire up Pyodide + SymPy in a Web Worker (`src/math-engine/`) so typing/
  writing `expr =` returns a solved result.

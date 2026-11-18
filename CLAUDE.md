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

Phase 1A is "the notepad and the library", built in small steps. Steps 1
(Library), 2 (ink canvas: draw, pan, pinch-zoom, palm rejection, autosave),
2b (canvas tools: pen/highlighter colour+size, stroke eraser, undo/redo),
2c (page background picker), and 2d (scratch-out gesture, as an opt-in
toggle that only erases ink it actually overlaps — fixed and confirmed
after initially misfiring on cursive) are all done and confirmed working
on the actual tablet. Step 2e (S Pen side button = temporary eraser) was
tried and **dropped**: confirmed on the tablet that Chrome doesn't expose
that button through the Pointer Events API at all, so it was removed
rather than fixed — see its section below before anyone considers
retrying it. Step 3 (symbol palette: Greek letters + operators,
press-and-drag to place) is done and confirmed working on the actual
tablet, after being revised from an initial tap-to-center design based on
that same tablet feedback. Step 4 (Settings screen: Gemini key,
Suggest/Quiet, dark mode — all stored, none wired up to behaviour yet) is
done and confirmed working on the actual tablet. Step 5 (library backup
export/import, settings excluded on purpose) is also done and confirmed
on the tablet as a full real round trip. Step 6 (lasso select: circle to
select, drag inside to move, Duplicate/Delete) is built and only
partially verified — selecting works, but move/duplicate/delete/undo and
symbol selection still need to be exercised (see its section below for
exactly what to check) before this is tablet-tested or Phase 1A is
considered done.

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
  - `PageScreen.tsx` — header (Back + title) wrapping the real `InkCanvas`
    for that page. Replaced the old `PagePlaceholder.tsx` (deleted).
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
- **Bug found and fixed during tablet testing**: folder/notebook/page
  titles were invisible (white text on a white card) on the tablet, which
  runs Chrome with dark mode / "auto dark theme" on. Any `<button>` or
  plain `<div>` that doesn't set an explicit `color` can get force-darkened
  to white text by the browser in that mode — inheriting color from an
  ancestor isn't enough, every text-bearing style in `styles.ts` (notably
  `card` and `headerTitle`) now sets `color` explicitly. **Keep doing this
  for every new piece of UI** — it's an easy thing to forget and only shows
  up once you actually test in dark mode.
- **Also found while building Step 2**: `useLiveQuery(() => table.get(id))`
  from `dexie-react-hooks` returns `undefined` both while the query is
  still loading *and* when the row genuinely doesn't exist — there's no way
  to tell those apart from the raw value. That made a perfectly real,
  freshly-created notebook/page flash (or get stuck on) a "this was
  deleted" message for a frame while IndexedDB answered the first query.
  Fixed with `src/library/useEntity.ts`, a tiny wrapper that turns "not
  found" into `null` and leaves "still loading" as `undefined`, so callers
  can tell them apart (`FolderScreen`, `NotebookScreen`, `PageScreen` all
  use it now). **Use `useEntity`, not a raw `useLiveQuery(() =>
  table.get(id))`, for any future single-record lookup by id.**
- GitHub Pages install note: the installed PWA can take **two full closes
  and reopens** (not just switching away and back) before it picks up a
  pushed update — the first reopen finishes installing the new service
  worker in the background, the second one actually serves it. Expected
  behaviour of `registerType: 'autoUpdate'`, not a bug; don't chase it as
  one if a tablet test looks stale right after a push.

### Step 2 — Infinite ink canvas: DONE ✅ (tablet-tested — draw, pan,
pinch-zoom, and palm rejection while writing all confirmed working)

- `src/storage/db.ts` v2: added a `strokes` table (`id, pageId, createdAt`
  indexed) and an optional `Page.background` field. Purely additive — no
  migration function needed, existing folders/notebooks/pages are
  untouched (Rule 2). A `Stroke` is `{ id, pageId, tool, color, size,
  points: [x, y, pressure][], createdAt }`, points stored in **page-space**
  coordinates (independent of pan/zoom, so panning/zooming never touches
  saved data). `addStroke`/`deleteStroke`/`deleteStrokes` added;
  `duplicatePage` now also copies a page's strokes; `emptyTrash` now also
  hard-deletes strokes belonging to permanently-deleted pages (no orphan
  rows).
- `src/canvas/InkCanvas.tsx` — the actual drawing surface, reusing Phase
  0's `perfect-freehand` stroke rendering. Two stacked `<canvas>`
  elements: `base` (background pattern + every committed stroke; repainted
  only when the stroke list or the pan/zoom transform changes) and `live`
  (just the in-progress stroke, repainted on every pointer move) — keeps
  per-move-event work small regardless of how many strokes a page already
  has. Pan/zoom transform (`offsetX, offsetY, scale`) lives in a ref, not
  React state, since it changes every animation frame during a gesture.
  - S Pen (and mouse, for laptop testing) draws.
  - One-finger touch pans (via native `movementX/Y`); two-finger touch
    pinch-zooms (zoom anchored at the old midpoint, then panned by how
    much the midpoint itself moved, so pinch + two-finger drag combine
    correctly). Zoom clamped to 0.2×–6×.
  - While a pen stroke is in progress, ALL touch is ignored outright —
    cheap palm-rejection layered on top of whatever the OS already does.
    Not verified whether this is sufficient on the actual tablet; if palm
    strokes still leak through during real use, the next fix is probably
    ignoring touch points that land very close to an active pen position,
    not just "any touch during a pen stroke" (which this already does).
  - Autosave: a completed stroke is persisted to Dexie on pointerup,
    fire-and-forget — drawing itself never waits on IndexedDB.
- `src/canvas/background.ts` — paints blank/lined/grid/dotted patterns in
  page-space (lines/dots 32 page-units apart), so grid cells scale with
  zoom and pan with content, consistent with "infinite canvas". Line width
  is divided by `scale` so grid lines stay ~1 screen pixel at any zoom.
- `src/canvas/strokeToPath.ts` — copy of the Phase 0 helper (the one in
  `src/pages/strokeToPath.ts` is now dead code alongside `PenTestPage.tsx`,
  since nothing imports `PenTestPage` anymore; fine to delete both, not
  done yet in case anything still references them).
- **Confirmed on the actual tablet**: S Pen drawing feel, one- and
  two-finger pan, two-finger pinch-zoom, and palm rejection while writing
  all work.

### Step 2b — Canvas tools: pen/highlighter/eraser, undo/redo — DONE ✅
(tablet-tested — toolbar, colors/sizes, highlighter, eraser, undo/redo all
confirmed working)

- `src/canvas/Toolbar.tsx` — floating bar over the canvas: Pen /
  Highlighter / Eraser, 6 pen colours / 4 highlighter colours (swapped
  depending on the active tool), 3 pen sizes / 2 highlighter sizes, and
  Undo / Redo. Colours and sizes in `src/canvas/colors.ts`.
- Highlighter strokes render at `HIGHLIGHTER_ALPHA` (0.4) opacity via
  `ctx.globalAlpha`, so ink drawn underneath still shows through.
- Stroke eraser: dragging over a stroke while the Eraser tool is active
  deletes the *whole* stroke it touches (not partial/pixel erasing).
  Hit-testing is against each stroke's line **segments**, not just its
  stored points — a quick/sparse stroke (few points) still gets a
  reliable hit anywhere along its visible length. Catch radius is a fixed
  screen-pixel radius converted to page-space by the current zoom, so it
  feels the same size on screen at any zoom level.
- Undo/redo is an in-memory command stack (`{ type: 'add' | 'erase',
  stroke }`) scoped to the current page visit — it resets when you leave
  and reopen the page, it doesn't persist across reloads. That matches
  how most editors behave and was the simplest correct option; revisit
  only if it turns out confusing in practice.
- **Bug found and fixed while building this**: `handleUndo`/`handleRedo`
  originally ran their Dexie writes (`addStroke`/`deleteStroke`) *inside*
  a `setState` updater function. React (deliberately, in StrictMode) can
  invoke an updater function more than once per call to help surface
  exactly this kind of impurity — here it caused `addStroke` to run twice
  for the same stroke id and throw `ConstraintError: Key already exists`.
  Fixed by reading the action from plain state first, then running every
  side effect once, outside any updater. **Rule going forward: a
  `setState(prev => ...)` updater must be a pure function of `prev` —
  never call `addStroke`/`deleteStroke`/another setter's side effect from
  inside one.**
- **Not implemented yet** (intentionally — small steps): lasso select
  (move/copy/delete).

### Step 2c — Page background picker: DONE ✅ (tablet-tested)

- `PageScreen.tsx` header got a "Background: …" button that opens a small
  dropdown (Blank/Lined/Grid/Dotted), writing straight to
  `setPageBackground` — `InkCanvas` already rendered all four patterns,
  this just exposes the existing field in the UI.
- **Bug found and fixed while building this**: the dropdown was rendering
  *behind* `InkCanvas`'s own floating `Toolbar`, because neither of the
  canvas's relatively-positioned wrapper divs set their own `zIndex` — so
  they never form a CSS stacking context, and the Toolbar's `zIndex: 5`
  ends up competing directly against the header's `zIndex` **at the page
  root**, not scoped inside the canvas the way it looks like it should be.
  Fixed by raising `styles.ts`'s shared `header` to `zIndex: 20`,
  comfortably above the Toolbar. **Rule going forward: any header dropdown
  that overlays the canvas needs the header's zIndex to stay above 5 (the
  Toolbar's), or the canvas wrapper needs its own zIndex to properly
  contain the Toolbar's stacking.**

### Step 2d — Scratch-out gesture: DONE ✅, revised after tablet feedback

First version auto-detected any back-and-forth zigzag as scratch-out,
always on. **Tablet-tested: cursive handwriting triggered it constantly**
(fast cursive loops look a lot like a zigzag), so this was reworked:

- **Off by default**, with a "Scratch-out: Off/On" toggle in the Toolbar
  (`scratchOutEnabled` state in `InkCanvas.tsx`, passed to `Toolbar.tsx`).
  Resets to off on reload (not persisted) — revisit if that's annoying in
  practice, e.g. by moving it into the Settings screen once that exists.
- Even when on, a gesture is only treated as scratch-out if it actually
  overlaps existing ink (`gestureOverlapsAnyStroke`, same per-point
  `strokeHit` test the Eraser tool uses). Writing on blank space never
  gets erased no matter what shape it makes — this was the main ask:
  scratch-out should only ever fire when you're visibly writing over
  something, not as a blanket gesture classifier.
- `isScratchGesture(points)` itself is unchanged: flags a gesture as
  "scratch, not ink" when its path is ≥2.5× longer than its own
  bounding-box diagonal and reverses direction sharply (>107°) at least 3
  times. With the overlap gate added, this heuristic only has to
  distinguish "scribble over ink" from "ordinary writing over ink" —
  doesn't need to be perfect on its own anymore.
- Verified (overlap gate) with synthetic pointer events: a zigzag on blank
  space stays as ink with the toggle on; the same zigzag drawn over an
  existing stroke erases it; an untouched stroke elsewhere is unaffected.
- **Tablet-tested after the fix: confirmed working.** Off by default,
  cursive stays untouched, and the overlap gate behaves as intended.

### Step 2e — S Pen side button as a temporary eraser: DROPPED ❌

Tried, tablet-tested, confirmed impossible on this device — removed.

- Implemented via `handlePointerDown` checking `pointerType === 'pen'`
  with `buttons > 1`, meant to erase for the duration of one stroke
  without changing the Toolbar's selected tool.
- Added a temporary on-screen debug readout showing the live
  `pointerType`/`buttons`/`button` from each pointer event, since the
  feature didn't work and a desktop browser can't simulate a real S Pen
  button press (synthetic `dispatchEvent` pointerdowns fail at
  `setPointerCapture` — see git history on this file around
  2026-11-17 if the detail is ever needed again).
- **Confirmed on the actual tablet: the debug readout never changes when
  the side button is pressed**, down or mid-stroke. Chrome on this
  tablet does not expose the S Pen's side button through the Pointer
  Events API at all — there's no signal for any code to react to, so this
  isn't a bug to fix, it's a platform limitation. Both the detection code
  and the debug readout have been removed; `handlePointerDown`/`Move`/`Up`
  are back to checking the Toolbar's `tool` state directly, same as
  before Step 2e.
- **Don't retry this approach.** If a hardware-button eraser shortcut is
  wanted later, it would need a different mechanism than Pointer Events
  `buttons` on this tablet — not worth more time without a genuinely new
  idea for how to detect it.

### Step 3 — Symbol palette: DONE ✅, revised after tablet feedback

First version placed a tapped symbol at the view's center (plus jitter).
**Tablet feedback: wanted press-and-drag placement instead** — hold the
symbol, drag to where you want it, release to drop — so that's what it
does now:

- `src/storage/db.ts` v3: added a `symbols` table (`id, pageId,
  createdAt`). Additive only, same as v2 — no migration needed. A
  `PlacedSymbol` is `{ id, pageId, char, x, y, size, color, createdAt }`,
  `x`/`y` in page-space (same convention as a `Stroke`'s points).
  `addSymbol`/`deleteSymbol` added; `duplicatePage` now also copies a
  page's symbols; `emptyTrash` now also deletes symbols belonging to
  permanently-deleted pages — same pattern as strokes throughout.
- `src/canvas/symbols.ts` — the palette's contents: `GREEK_LOWER` (24),
  `GREEK_UPPER` (24), `OPERATORS` (the 12 from the spec: ∂ ∇ ∞ ∥ ∠ ≈ ≠ ≤
  ≥ ∫ Σ √).
- `src/canvas/SymbolPalette.tsx` — a panel opened by a new "Ω Symbols"
  button in `Toolbar.tsx`. Each character button starts a drag on
  `onPointerDown` (not `onClick`) — a plain tap never places anything,
  since it ends on the same button, not over the canvas.
- `InkCanvas.tsx`: `handleSymbolDragStart` records the character and
  starts following the pointer; a `useEffect` attaches **window-level**
  `pointermove`/`pointerup`/`pointercancel` listeners only while a drag
  is active, since the pointer leaves the originating palette button
  immediately and the canvas's own pointer handlers never see it. The
  palette hides itself the instant the drag starts (so the canvas is
  fully visible to drop onto), and a small floating character (`position:
  fixed`, follows the pointer, `pointerEvents: 'none'`) previews where it
  will land. On release: if the drop point is within the live canvas's
  bounding rect, `placeSymbolAt` creates the symbol there (converting
  through `screenToPage`, same as ink); otherwise nothing is placed.
- Placement is undoable (`UndoAction` gained an `'add-symbol'` variant)
  and persists like a stroke — verified: drag-drop, undo, redo, leave the
  page and come back, all behave correctly, including the drop landing
  exactly where the pointer was released (not at some center/jittered
  point).
- Rendered on the base canvas via `ctx.fillText`, alongside strokes, so
  it scales and pans with the page exactly like ink.
- **Not implemented yet**: deleting or moving a symbol *after* it's
  already placed (the Eraser tool and scratch-out both currently only
  affect strokes, not symbols) — likely bundled with lasso select later,
  since "select and move" is the same mechanism either way.
- **Confirmed on the actual tablet** with the real S Pen: drag feels
  natural and the drop lands exactly where released.

### Step 4 — Settings screen: DONE ✅ (tablet-tested)

- `src/storage/db.ts` v4: added a `settings` table holding a single row
  keyed by the fixed id `SETTINGS_ID` (`'app'`). Additive only, same
  pattern as v2/v3 — no migration needed; `getSettings()` returns
  `DEFAULT_SETTINGS` if the row doesn't exist yet (first run), so there's
  nothing to seed at startup. `AppSettings` is `{ id, geminiApiKey:
  string | null, suggestMode: boolean, darkMode: boolean }`.
  `updateSettings(patch)` reads-then-writes the merged row.
- `src/library/SettingsScreen.tsx`, reachable via a new "Settings" button
  on `HomeScreen`. Three sections: Gemini API key (password-masked input
  with Show/Hide, Save, and a Clear button that only appears once a key
  is set), Suggest/Quiet mode (segmented control), Dark mode (segmented
  control). The key field uses a local draft buffer, committed on blur or
  Save — not written to Dexie on every keystroke.
- **Rule 1 compliance, explicitly**: the key is never logged, never
  rendered in plaintext by default (password input + a separate Show
  toggle), and the help text under the field says in plain language
  where it is and isn't sent. Nothing here reads it except this screen;
  Phase 1B's AI assist will be the first thing that ever sends it
  anywhere, and that will go straight to Google's API, never through our
  own servers (we have none).
- Suggest/Quiet and dark mode are **stored only** — neither changes any
  app behaviour yet, by design (Suggest/Quiet has nothing to gate until
  the interaction-model triggers exist in Phase 1B+; dark mode has no
  theme to switch into yet). The screen says this plainly in its own help
  text so it's not confusing that flipping the toggle visibly does
  nothing elsewhere in the app right now.
- **Confirmed on the actual tablet**: key field, Show/Save/Clear, and
  both segmented toggles all work and persist. Fahed noted the Dark mode
  and Suggest/Quiet toggles don't visibly change anything — confirmed
  that's expected (by design, as above), not a bug.

### Step 5 — Library backup export/import: DONE ✅ (tablet-tested)

- `src/storage/backup.ts` — `buildBackup()` gathers every folder,
  notebook, page, stroke, and symbol (including trashed ones, so a
  restore can't silently lose something the user hadn't emptied from
  Trash yet) into `{ version: 1, exportedAt, folders, notebooks, pages,
  strokes, symbols }`. `downloadBackup()` wraps that as a JSON file and
  triggers a normal browser download (`math-notepad-backup-YYYY-MM-DD.json`,
  via an `<a download>` + `Blob` URL — no server involved, it's all
  client-side). `parseBackupFile(file)` validates the shape (version tag
  + all five arrays present) before accepting it, with a plain-language
  error if the file's wrong or corrupted. `importBackup(backup)`
  `bulkPut`s every row by id in one transaction.
- **Settings (the Gemini key especially) are deliberately NOT included**
  in the backup file — see the comment in `backup.ts`. A backup is
  something the user might email to themselves or move via USB; the key
  must never ride along in that file (Rule 1).
- **Import is additive, never destructive**: `bulkPut` overwrites by id
  but never deletes anything not in the backup, so importing can't lose
  notes made since the backup was taken (Rule 2), and importing the same
  file twice is harmless (second time just overwrites with identical
  data). There's no "replace everything" option — if a clean restore onto
  an empty library is ever wanted, that's a manual "clear library first"
  step the UI doesn't offer yet.
- UI lives in `SettingsScreen.tsx`'s new "Library backup" section:
  "Export backup" and "Import backup…" (a hidden `<input type="file">`
  behind a styled button). Importing shows a confirm dialog first,
  naming the backup's date and item counts, before writing anything.
- **Confirmed on the actual tablet**: the full real round trip — export
  downloads to the device, the file picker finds it, import merges it
  back in cleanly — all work.

### Step 6 — Lasso select: BUILT, PARTIALLY VERIFIED 🚧 (not yet tablet-tested)

- New `'lasso'` tool. Drag to circle strokes/symbols (point-in-polygon
  hit test in `src/canvas/lasso.ts` — a stroke counts as selected if any
  one of its points is inside the drawn loop; a symbol if its anchor
  point is). Selected items get a dashed blue bounding-box outline
  (drawn in `redrawBase`, so it pans/zooms correctly with the page).
- Dragging a new lasso **starting inside** the current selection's
  bounds moves the whole selection instead of starting a fresh lasso —
  implemented in `InkCanvas.tsx` (`tryStartMove`/`applyMoveDelta`/
  `commitMove`). Move is live-previewed by directly updating `strokes`/
  `symbols` state during the drag and persisted (`updateStrokePoints`/
  `updateSymbolPosition`) on release, with full undo/redo support (new
  `UndoAction` variants: `'erase-symbol'` and `'move'`).
  "Duplicate" and "Delete" buttons appear in the Toolbar when the lasso
  tool has an active selection (`Toolbar.tsx`); Duplicate offsets the
  copy by 24 page-units and selects the copy so it can be dragged into
  place immediately.
- **Bug found and fixed while building this**: `e.currentTarget.
  setPointerCapture(e.pointerId)` in `handlePointerDown` was called
  unprotected — if it throws (which it reliably does for *any*
  synthetic/non-trusted pointer event, discovered while testing this
  feature), the exception aborted the entire handler, silently skipping
  every tool's logic for that pointerdown (eraser, lasso, drawing — all
  of it). Wrapped in try/catch; capture is best-effort anyway (events
  still bubble normally if the pointer stays over the canvas). This was
  a latent bug in the drawing code since Step 2, just never triggered
  because real hardware pointers don't hit it — only found now because
  lasso is the first gesture that *needed* reliable synthetic-event
  testing (a closed loop can't be drawn via a single click-drag the way
  every other tool so far could be tested).
- **Verified**: drawing a lasso around a stroke correctly selects it
  (dashed outline + Duplicate/Delete appear) — confirmed in the desktop
  browser preview, including after the setPointerCapture fix.
- **NOT yet verified**: move-by-dragging-inside-selection, Duplicate,
  Delete, undo/redo of any of those, and symbol selection specifically
  (only a stroke was tested) — testing was interrupted by hitting a
  session usage limit mid-verification, not by a known failure. The code
  path exists and builds cleanly, but treat it as unconfirmed until
  actually exercised — on the tablet is fine, but go through all of:
  select → drag to move → Undo → Redo → Duplicate → drag the duplicate
  away → Delete → Undo before trusting this feature.

### What's still after that in Phase 1A

- Nothing — lasso select (above) is the last unverified piece. Once it's
  gone through the verification checklist above, Phase 1A is complete.

## Improvement pass — Tratto comparison (in progress 🚧)

Before Phase 2, we studied **Tratto** (github.com/lampedev/tratto), a
Kotlin/Jetpack Compose handwriting app for Samsung tablets with S Pen, as a
reference for ideas, UI and behaviour only. **It has no LICENSE file**, so
nothing was copied — every change below is our own fresh TypeScript/CSS,
and its code is Kotlin/Compose anyway, so there was nothing copy-paste
compatible with our Vite/React/TS stack even if it had a license. The repo
was cloned to `../tratto-reference` (outside this project, gitignored by
location, not tracked here).

A full feature-by-feature comparison table (ink/pen prediction, pen types,
zoom, lasso, eraser, shape recognition, paper templates, vector PDF export,
PDF annotation, folders/tags/search, notebook links + graph view, PDF
folder sync, Samsung Notes `.sdocx` import, overall look) was given to
Fahed; he's picking which to build next, one at a time, tablet-tested and
committed individually per the usual rule.

### Step A — Paper colour + extended zoom: DONE ✅ (built, not yet tablet-tested)

First two items picked off the comparison table, both cheap/low-risk:

- `src/storage/db.ts`: added `PaperColor = 'white' | 'black' | 'blue' |
  'graphite'` and an optional `Page.paperColor` field. Additive only, same
  pattern as every prior schema addition — absent on old pages, defaults to
  `'white'` when reading (no migration needed, Rule 2). `setPaperColor`
  helper added alongside `setPageBackground`.
- `src/canvas/background.ts`: exports `PAPER_COLORS`, a `{ fill, line }`
  map per paper colour — the line/dot pattern colour is chosen per paper so
  it stays visible on dark paper (e.g. a muted dark-blue-grey line on black
  OLED, not the same grey used on white). `paintBackground` takes an
  optional `paperColor` param (defaults to `'white'`).
- `src/canvas/InkCanvas.tsx`: takes an optional `paperColor` prop, used for
  the base canvas fill (replacing the old fixed `BG_COLOR` constant, now
  removed) and passed through to `paintBackground`. Zoom clamp raised from
  6× to **10×** (1000%, matching Tratto) — pinch-zoom only, no other UI
  change needed since strokes/background already redraw at any scale via
  the existing `scale`-aware line widths.
- `src/library/PageScreen.tsx`: the existing "Background: …" dropdown
  gained a row of 4 colour-swatch buttons (white/black/blue/graphite) below
  the pattern list, writing straight to `setPaperColor` — same dropdown,
  no new button, to keep the header from getting crowded.
- Verified in the desktop browser preview: switching paper colours
  repaints immediately; grid lines stay legible on black/blue/graphite;
  switching background pattern and paper colour together works; reverted
  cleanly back to white/blank. **Not yet verified**: pinch-zoom actually
  reaching 1000% smoothly on the real tablet (the clamp change itself is a
  one-line, low-risk number change, but zoom *feel* at extreme levels —
  whether strokes stay smooth, whether performance holds — needs the real
  S Pen + touch to confirm).

## What Phase 1 will need

- A basic recognition step (even a simple/placeholder one at first) to turn
  strokes into a math expression string.
- Wire up Pyodide + SymPy in a Web Worker (`src/math-engine/`) so typing/
  writing `expr =` returns a solved result.

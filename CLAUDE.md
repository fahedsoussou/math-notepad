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

### Step B — Visual style pass (Tratto's look): DONE ✅ (built, not yet tablet-tested)

Fahed sent the actual Tratto source (`tratto-main.zip`) and asked for its
style specifically. Looked only at `ui/Theme.kt` (Compose colour scheme,
typography weights, corner radii) and `res/values/colors.xml` — these are
just colour hex values and dp numbers, not copyrightable expression, and
there's still no LICENSE, so no Kotlin/Compose code or text was copied;
every line below is fresh TS/CSS matching the same look.

- **New accent colour**: `ACCENT = '#1F3A5F'` (an ink-blue), exported from
  `src/library/styles.ts`, replacing the old near-black (`#1e1e2e`) accent
  everywhere it was used as a highlight/active colour — active toolbar
  tool, selected colour/size swatch border, primary buttons (Save, +
  Folder, New folder's Save), active Settings segmented-control option.
  **Not changed**: `#1e1e2e` is still used as plain body/title text colour
  throughout (it's close enough to Tratto's own near-black text and
  changing it everywhere wasn't worth the churn), and the ink pen colour
  swatches in `colors.ts` (user-facing drawing colours, unrelated to app
  chrome).
- **Cooler neutral backgrounds/borders**: page background `#f4f4f5` →
  `#f4f6f9`, icon-button background `#eceef1` → `#e6eaf0`, header/card
  borders `#e4e4e7` → `#d7dde5` — all in `styles.ts` plus the couple of
  places (`PageScreen.tsx`, `Toolbar.tsx`, `SettingsScreen.tsx`) that had
  the old values inlined instead of importing from `styles.ts`.
  Corner radii were already 8px (buttons) / 12px (cards), which already
  matched Tratto's own small/medium shape scale — no change needed there.
- **Rule going forward**: any new accent/primary-action colour should use
  `ACCENT` from `styles.ts`, not a new hardcoded hex, so a future theme
  change (e.g. real dark mode) only needs to update it in one place.
- Verified in the desktop browser preview: Settings buttons/segmented
  controls, the canvas Toolbar's active tool, the New Folder dialog's
  swatch border + Save button, and page backgrounds all show the new
  ink-blue/cooler palette consistently. **Not yet tablet-tested.**

### Step C — Pen types (fountain/ballpoint/pencil/calligraphy/marker): DONE ✅ (built, not yet tablet-tested)

Fahed wants to take Tratto's UI/UX more broadly (library + pages), to
customize toward math later; picked "different pen types and textures"
as the next concrete piece, since that's directly implementable without
restructuring the library. Highlighter is unaffected — this only adds
texture/feel variants to the `'pen'` tool.

- `src/storage/db.ts`: new `PenType = 'fountain' | 'ballpoint' | 'pencil'
  | 'calligraphy' | 'marker'`, and an optional `Stroke.penType` field.
  Additive, same pattern as every other schema addition — absent on old
  strokes (and on highlighter strokes, where it's meaningless), defaults
  to `'fountain'` when reading. `'fountain'`'s tuning is deliberately
  identical to the app's original (only) pen feel, so every stroke drawn
  before this step still renders exactly as before.
- `src/canvas/colors.ts`: `PEN_TYPES`, `PEN_TYPE_LABELS`, and
  `PEN_TYPE_OPTIONS` (perfect-freehand `thinning`/`smoothing`/`streamline`
  + a fill `alpha` per type). These are tuned numbers, not anything from
  Tratto's actual brush code (which is Kotlin + native `androidx.ink`
  brush families — not portable or legal to copy; no license, as noted in
  Step B) — just picked to feel distinct: ballpoint is thin/uniform/crisp,
  marker is thick/low-taper/slightly translucent, pencil is desaturated
  with added grain (below), calligraphy ignores its own thinning value and
  instead derives per-point width from stroke *direction* (below).
- `src/canvas/InkCanvas.tsx`:
  - `paintStroke` now takes an optional `PenType` and looks up its preset;
    highlighter/eraser/lasso are unaffected (only `tool === 'pen'` reads
    `PEN_TYPE_OPTIONS`).
  - **Calligraphy**: `applyCalligraphyAngle()` rewrites each point's
    pressure based on the stroke's local direction relative to a fixed
    45° "nib" angle (`0.35 + 0.65 * |sin(angle - nibAngle)|`), before
    handing points to `getStroke` — a diagonal stroke comes out
    noticeably thicker than a stroke along the nib's own axis, the
    classic chisel-tip look. Verified in the desktop preview: a diagonal
    test stroke rendered visibly thicker than a horizontal one with the
    same pen size.
  - **Pencil texture**: `paintPencilTexture()` clips to the stroke's own
    filled outline and multiply-blends a small (24×24, built once and
    cached) random-dot pattern over it at low alpha — cheap grain, no
    image asset. Combined with a lower base fill alpha (0.72), pencil
    strokes read as lighter and textured next to solid-black fountain/
    ballpoint strokes. Verified: visibly lighter/greyer in the preview;
    fine-grain visibility at normal viewing size needs the real tablet
    screen to judge properly.
  - A pen-type `<select>` dropdown was added to `Toolbar.tsx`, shown only
    when `tool === 'pen'` (hidden for highlighter/eraser/lasso), next to
    the colour/size controls.
- Verified in the desktop browser preview: switching type via the
  dropdown changes new strokes only (existing strokes keep their stored
  `penType`); fountain vs. ballpoint width/taper difference is visible
  side by side; pencil renders lighter; calligraphy's angle-dependent
  width is visible. **Not yet tablet-tested** — pressure-based width
  (fountain, calligraphy) depends on real S Pen pressure data, which this
  desktop preview can't provide (synthetic pointer events have no real
  pressure curve), so the *feel* of each type needs confirming on the
  actual tablet before trusting it.

### Step D — Library (Home) screen redesign to match Tratto's look: DONE ✅ (built, not yet tablet-tested)

Fahed sent 3 screenshots of Tratto's actual UI (library grid, "New
notebook" dialog, editor toolbar/menu) and asked to match "almost
everything", in English, reusing what's good. This is being done as
several steps (library screen first; the New notebook dialog and editor
toolbar are separate, still-open steps below) rather than one big reskin,
per Rule 3 — each gets tablet-tested on its own before the next starts.

- New `src/library/icons.tsx`: a small set of **original** inline SVG
  icons (`FolderIcon`, `SettingsIcon`, `TrashIcon`, `PageIcon`) — own
  paths, not copied from Tratto (Material icons, not even Tratto's own
  asset) or any icon library, used to move the chrome from text buttons
  toward icon-first, matching the reference screenshots' style.
  `FolderIcon` renders the two-tone folder-with-tab silhouette from the
  library grid; the other three are simple line icons.
- `src/library/styles.ts`: added `iconCircleButton` (round 40px icon
  button), `badge` (small red count badge, used for the Trash count),
  `floatingActions` (fixed bottom-right stack), and `pageCard`/
  `pageCardThumb`/`pageCardBody` (a taller, page-shaped card replacing
  the old plain text card for notebook entries).
- `src/library/HomeScreen.tsx` rewritten:
  - Header is now "Your Notebooks" (matching Tratto's own title pattern,
    not the app's install name — that's still "Math Notepad" in the PWA
    manifest/home-screen icon) + two round icon buttons (Trash with a
    red count badge, Settings), replacing the old text buttons.
  - Folders render with `FolderIcon` (coloured per folder) + a real
    notebook count (new `notebookCounts` query, grouped by `folderId`),
    replacing the old plain dot + name.
  - Recent notebooks render as `pageCard`s (a page-icon placeholder
    "thumbnail" + title + date) instead of plain text cards — **not**
    real page-content thumbnails yet (that needs rendering a page's ink
    to a small cached image, a separate, bigger piece — noted as future
    work below, not done here).
  - "+ Folder" and "+ Quick notebook" became "+ New folder" / "+ New
    notebook", moved into a `floatingActions` bottom-right stack
    (matching the reference screenshot's bottom-right button placement),
    instead of one being in the header and the other a plain link at the
    bottom of the page.
- Verified in the desktop browser preview: icon buttons work (Trash
  navigates correctly, no stray badge when trash is empty), folder cards
  show the right icon colour and notebook count, floating buttons create
  a folder/notebook correctly. **Not yet tablet-tested** — icon tap
  targets (40px circles) need confirming they're comfortable with the S
  Pen/finger on the real screen.

### Step E — New notebook dialog: DONE ✅ (built, not yet tablet-tested)

- **"Format" (A4 portrait/landscape) deliberately left out.** Our pages
  are a truly infinite, pannable/zoomable canvas, not a fixed A4 sheet —
  there's no "page size" concept to set. Adding a Format toggle that did
  nothing would be a dead control; this is a real architectural
  difference from Tratto, not an oversight.
- `src/storage/db.ts`: `PageBackground` gained `'cornell'`. `PaperColor`
  is now a plain `string` (was a closed 4-value union) so a custom
  colour-wheel pick can be stored, not just the 4 named presets — old
  stored values ('white' etc.) are still valid strings, so this is a
  compatible widening, not a migration. New `LineSpacing = 'narrow' |
  'medium' | 'wide' | 'xwide'` (`'medium'` = the original fixed 32-unit
  spacing, so old pages render identically). `Page` gained `lineSpacing`
  and `marginLine` fields (additive, default medium/off when absent).
  `Notebook` gained `defaultBackground`/`defaultPaperColor`/
  `defaultLineSpacing`/`defaultMarginLine` — set once from the new
  dialog, and `createPage` now reads them from the parent notebook so
  every page in that notebook starts with the chosen look (still
  overridable per-page via the existing Background button). New
  `setLineSpacing`/`setMarginLine` helpers, parallel to `setPaperColor`.
- `src/canvas/background.ts`: `getPaperAppearance(paperColor)` added —
  looks up the 4 named presets as before, and for anything else (a
  custom hex) derives a visible line/grid colour from the paper's own
  luminance (lighten on dark paper, darken on light paper), so a custom
  paper colour never ends up with invisible ruling. `paintBackground`
  takes `lineSpacing` (picks the line/dot gap) and `marginLine` (draws a
  fixed red vertical line at page-space x=70, independent of the pattern
  — visible even on `'blank'`). `'cornell'` renders as the normal lined
  pattern to the right of a divider at page-space x=140, with nothing
  ruled to its left (the cue column) — **only the left-margin half of
  Tratto's two-part Cornell layout**: an infinite canvas has no fixed
  page bottom, so the classic "ruled area / cue column / bottom summary
  strip" three-part layout doesn't have a natural place to put the
  bottom strip. Noting this as a real limitation, not a bug.
- New `src/library/NewNotebookDialog.tsx`: title field (defaults to
  "Notes `<today's date>`"), a 5-pattern grid with small CSS-drawn
  previews (Blank/Lined/Grid/Dotted/Cornell), paper-colour row (4 preset
  swatches + a conic-gradient "custom" swatch that opens a hidden
  `<input type="color">`), a spacing segmented control, and a margin-line
  checkbox — Cancel/Create. Wired into both `HomeScreen.tsx` (replacing
  the old `window.prompt()` flow) and `FolderScreen.tsx`'s "+ Notebook"
  button, calling the new `createNotebook(folderId, name, defaults)`.
- **Bug found and fixed while building this**: the title `<input>` had
  no explicit `background`/`color`, so Chrome's auto-dark-mode force-
  darkened it to dark-on-dark (same class of bug as the Step 1 dark-mode
  text bug) — fixed by setting both explicitly. **Keep doing this for
  every new input/control, not just text.**
- Verified in the desktop browser preview end to end: picked Cornell +
  Wide spacing + Margin line + default (white) paper, created the
  notebook, added its first page, and confirmed it opened already set to
  "Background: Cornell" with both the Cornell divider and the red margin
  line rendering at their own distinct x positions. **Not yet
  tablet-tested** — the custom colour-wheel picker in particular should
  be tried with the S Pen/finger, since `<input type="color">` UI is
  OS-provided and may behave differently on Android.

### Step F — Editor toolbar as icons, page counter, page overflow menu: DONE ✅ (built, not yet tablet-tested)

Matches the reference screenshot's density (one compact icon bar) for
everything we actually have; deliberately **left out** menu items for
features that don't exist yet (bookmarks, export, favourites, tags,
auto-shapes, preferred-pens-bar, extra-smooth-edges, fullscreen,
write-with-finger, general settings) rather than add dead buttons — see
"Still open" below for where those stand.

- `src/library/icons.tsx` gained `PenIcon`, `HighlighterIcon`,
  `EraserIcon`, `LassoIcon`, `UndoIcon`, `RedoIcon`, `ChevronLeftIcon`,
  `ChevronRightIcon`, `OverflowIcon` — same own-paths approach as Step D.
- `src/canvas/Toolbar.tsx` rewritten: Pen/Highlighter/Eraser/Lasso are now
  icon buttons (was text). Undo/Redo are icon buttons. The always-visible
  "Scratch-out: On/Off" button moved into a new "⋮" overflow menu (opened
  via `OverflowIcon`), alongside new "Insert page after this one",
  "Duplicate page", and "Delete page" — decluttering the main bar to
  match the reference's single compact row. A page counter
  (`"{index+1}/{count}"`) with ‹/› chevron buttons sits between Redo and
  the overflow button, disabled at the first/last page.
- `src/storage/db.ts`: new `insertPageAfter(afterPageId, title?)` —
  creates a page at `current.order + 1` and shifts every later page's
  `order` up by one first, in a transaction (so a mid-shift crash can't
  leave two pages sharing an order). Inherits the notebook's defaults the
  same way `createPage` does.
- `src/library/PageScreen.tsx`: now takes `notebookId` and
  `onNavigatePage`, queries sibling pages (ordered) to compute the
  current page's index/count, and implements prev/next navigation plus
  Duplicate/Insert-after/Delete (delete asks to confirm, same as the
  existing per-page Delete in `NotebookScreen.tsx`, then goes back to the
  notebook).
- `src/library/LibraryApp.tsx`: the `'page'` route now carries
  `notebookId` through to `PageScreen` and provides `onNavigatePage` (re-
  routes to a sibling page id within the same notebook, same route
  shape).
- Verified in the desktop browser preview end to end: icon toolbar
  renders correctly; opened the overflow menu and used "Insert page
  after this one" (page count went 1/1 → 2/2, landed on the new page);
  used the ‹ chevron to go back to page 1/2, with Previous correctly
  disabled at the first page. **Not yet tablet-tested** — icon tap
  targets and the page-counter chevrons especially need a real-hand
  check for comfortable spacing.

### Step G — Pen-type icons + fix: pen types weren't actually applying: DONE ✅ (built, not yet tablet-tested)

Fahed reported the pen types from Step C "don't work" and asked for
icons instead of the text dropdown — both addressed together:

- **Real bug, not just missing polish**: `handlePointerUp` in
  `InkCanvas.tsx` builds the committed `Stroke` using `penType` from
  component state, but `penType` was missing from that `useCallback`'s
  dependency array. React kept the callback memoized with whatever
  `penType` was captured the first time its other dependencies changed —
  so **every stroke you actually drew got the old pen type**, no matter
  what the dropdown showed, which is exactly "it doesn't work". Live
  in-progress strokes looked right while drawing (that path already used
  a ref, `penTypeRef.current`, which is always fresh) — only the
  *committed* stroke silently reverted. Fixed by adding `penType` to the
  dependency array. **Rule confirmed again: everything a `useCallback`/
  `useEffect` reads from component state or props must be in its
  dependency list — a ref is the one exception, by design.** Verified by
  drawing with Fountain then Ballpoint back to back and zooming in: the
  two are now visibly different widths, and reloading the page keeps
  that difference (so it's really saved, not just visible mid-stroke).
- `src/library/icons.tsx` gained `FountainPenIcon`, `BallpointPenIcon`,
  `PencilIcon`, `CalligraphyPenIcon`, `MarkerPenIcon` — own simple line
  icons, one per pen type.
- `src/canvas/Toolbar.tsx`: the pen-type `<select>` dropdown from Step C
  is gone, replaced by 5 icon buttons (same row position, same
  highlight style as the main tool buttons) using a `PEN_TYPE_ICONS` map.
- **Not yet tablet-tested** — same caveat as Step C: pressure-based width
  differences (fountain, calligraphy) need the real S Pen to judge
  properly, now that they're confirmed to actually be applied.

### Step H — Pen textures made more realistic: DONE ✅ (built, not yet tablet-tested)

Fahed asked for more realistic textures/difference after Step G fixed
pen types actually applying. The biggest remaining issue was taper, not
texture: every pen type was still fading to a fine point at both stroke
ends (perfect-freehand's default `start`/`end` behaviour), which is
correct for a fountain pen but wrong for a ballpoint, marker, or
calligraphy nib — those stop abruptly at full width in real life.

- `src/canvas/colors.ts`: `PEN_TYPE_OPTIONS` gained a `taper: boolean`
  per type. `fountain`/`pencil` keep `taper: true` (fade to a point);
  `ballpoint`/`calligraphy`/`marker` are `taper: false` (blunt, constant
  width at the ends). Also retuned the numbers themselves: ballpoint
  thinner/crisper, pencil lower alpha (0.6, was 0.72) for a lighter
  touch, marker a touch more translucent (0.78).
- `src/canvas/InkCanvas.tsx`: `paintStroke` now passes `start`/`end: {
  taper, cap: true }` to `getStroke` based on that flag (highlighter/
  eraser/lasso unaffected — only `tool === 'pen'` reads it).
  `applyCalligraphyAngle`'s contrast widened from `0.35–1.0` to
  `0.12–1.0`, so a stroke along the nib's own axis comes out close to a
  hairline instead of just "thinner" — much closer to how a real chisel
  tip nearly vanishes edge-on. The pencil grain texture
  (`getPencilTexture`/`paintPencilTexture`) was rebuilt: bigger tile
  (32×32, was 24×24), more grains (140, was 50) at varied size and
  per-grain opacity instead of uniform 1px dots at one fixed opacity, and
  a stronger multiply blend (0.45 alpha, was 0.3) — reads as actual
  graphite sparkle now rather than a faint haze.
- Verified in the desktop browser preview, same page, size 8, strokes
  drawn side by side: fountain tapers to a point at its start, ballpoint
  right below it stays full-width/blunt at the same point — the taper
  fix is clearly visible zoomed in. Pencil is visibly lighter/grainier
  next to solid-black calligraphy. A near-horizontal calligraphy stroke
  came out near-hairline while a diagonal one through it came out bold,
  confirming the widened contrast. Marker's flat blunt end and
  translucency (showing the fountain stroke underneath) both visible.
  **Not yet tablet-tested** — this entire feature still rests on
  synthetic/mouse pressure in the desktop preview; the real test is
  whether fountain/calligraphy's pressure-driven width feels natural
  under the actual S Pen.

### Step I — Fixed "writing moves after finishing" + more pencil texture: DONE ✅ (built, not yet tablet-tested)

Fahed reported that right after finishing a stroke, the writing "kinda
moves in a weird way" — this turned out to be the page itself panning,
not ink actually moving, and it's the exact palm-rejection gap already
flagged as a risk back in Step 2 ("if palm strokes still leak through…").

- **Root cause**: if a palm/finger is already resting on the screen when
  a pen stroke starts (or briefly during it), its touch pointer gets
  registered in `touchPoints` on `pointerdown` (before `isDrawing` turns
  true) and then every subsequent `pointermove` for it is correctly
  ignored while drawing — but the map entry itself is never cleared, so
  it's still sitting there with a stale tracked position. The instant
  the pen lifts (`isDrawing.current = false`), the very next
  `pointermove` for that still-resting palm is no longer ignored and
  immediately pans the page via `transformRef.current.offsetX +=
  e.movementX` — which looks exactly like "my writing moved" right after
  finishing, because the *view* shifted under it.
- **Fix**: `handlePointerUp` (`InkCanvas.tsx`) now clears `touchPoints`
  and `lastPinch` the moment a pen/eraser/lasso stroke ends, for every
  tool, before any of the per-tool early returns. Any touch that was
  already down during the stroke is forced to be "rediscovered" — it's
  ignored until it's actually lifted and put down again (a fresh
  `pointerdown`), which re-registers it at its *current* position with
  no stale delta, instead of panning off a leftover one.
- **Cannot be verified in the desktop browser preview** — this is
  specifically a multi-pointer (pen + simultaneous resting touch)
  scenario that synthetic/mouse-only testing can't reproduce. The fix is
  verified by code inspection (the exact mechanism above) and must be
  confirmed on the actual tablet by writing normally with the hand
  resting on the screen, the way Fahed normally holds it.
- **Pencil texture, round 2**: added `applyPencilJitter()` — nudges each
  point slightly sideways off the stroke's own direction by a small,
  deterministic pseudo-random amount (same input always jitters the same
  way, so a committed stroke doesn't visibly wobble on every repaint).
  A real pencil line is never as perfectly smooth as perfect-freehand's
  curve fit makes it look; this roughens the edge on top of the Step H
  grain texture. Verified in the desktop preview: the pencil stroke's
  edge now visibly isn't a clean curve, next to the still-smooth
  fountain/ballpoint strokes.

### Still open from Fahed's "match the design" request

- **Real page-content thumbnails** for notebook/folder cards (currently a
  placeholder page icon) — needs rendering a page's ink to a small
  cached image on save, which is new capability, not just styling.
- Folder/notebook screens (`FolderScreen.tsx`, `NotebookScreen.tsx`,
  `TrashScreen.tsx`) still use the pre-redesign plain-card look and
  text buttons — not updated in this step, so the app is visually
  inconsistent between Home and those screens until they get the same
  pass.

## Autonomous session, 2026-11-18 — Phase 1 math engine built (DONE, tablet untested)

Fahed asked for an autonomous session through Phases 3→4→5→6→2→7, working
without feedback since he was unavailable. **Full detail, bug-by-bug, is in
`PROGRESS.md` — read that file for this session's work, not just this
summary.** `TABLET-TESTS.md` has what to test when back on the tablet.

Short version: Phases 3–6 all need a working math engine, which didn't
exist yet (only Phase 1A's library/canvas did) — so Phase 1 (recognition
placeholder + SymPy/Pyodide math engine) was built first, as a technical
necessity, not a detour from the instruction.

- `src/math-engine/` (new): `pythonSource.ts` (SymPy logic, shared
  verbatim between the browser Worker and the Vitest test bank),
  `worker.ts` (Pyodide in a Web Worker, loaded from a CDN — full offline
  math is a later Phase 7 item), `client.ts` (timeout/Cancel/respawn —
  Python can't be interrupted mid-call, so cancelling means terminating
  the worker), `MathPanel.tsx` (the UI: Solve/Differentiate/Integrate/
  Simplify with KaTeX-rendered, numerically-verified steps).
- Real step-by-step for linear/quadratic solving and a genuine recursive
  derivative decomposer (sum/product/power/chain rule + elementary
  functions) and integral rules (sum/constant/power + sin/cos/exp) — not
  one opaque library call. Anything outside that falls back to a single
  SymPy call, honestly marked `unverified_breakdown: true`.
- Every result is checked numerically (substituting random values), per
  Fahed's quality rule — not just trusted from SymPy.
- `tests/`: a real Vitest test bank (63 tests, not mocked — loads actual
  Pyodide+SymPy under Node) covering solve/diff/integrate/simplify.
  `npm test` runs it. Growing alongside each new phase (series/stats/
  matrices/ODEs/electrical don't exist yet, so can't be tested yet).
- `src/storage/db.ts`: `AppSettings` gained notation fields
  (`imaginaryUnit`, `eulerAsVariable`, `implicitMultiplication`,
  `electricalMode`) — additive, engine already honours them, **Settings
  screen UI for these not built yet**.
- Six real bugs found and fixed while building this (symbol-identity
  mismatch that silently zeroed every derivative, a `real=True` SymPy
  correctness issue, template-literal backticks, module-vs-classic worker/
  importScripts, timeout counting Pyodide's cold-start download, and a
  JsProxy/dict mismatch) — see `PROGRESS.md` for the full story on each;
  worth reading before touching `pythonSource.ts` or `worker.ts` again.
- **Verified live in the browser** (quadratic solve, product-rule
  derivative), not just unit tests. **Not yet tablet-tested** — needs a
  network connection the first time per session, which the tablet test
  must confirm works the same as desktop.

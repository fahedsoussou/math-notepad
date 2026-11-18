# Progress — autonomous session (2026-11-18)

Started from Fahed's instruction to work autonomously through the roadmap
(Phase 3 → 4 → 5 → 6 → 2 → 7, plus Check-my-work / notation settings /
timeout+Cancel+Ask AI) without waiting for feedback, since he's unavailable.
Read this alongside `CLAUDE.md` (the stable project reference) — this file
is the session log: what's actually done, in what order, and what's left.

## Order correction (not a "Needs Fahed" — a technical necessity)

Phase 3 (step-by-step) through Phase 6 (advanced math) all need a working
math engine, and that engine — Phase 1 ("Write and solve MVP": recognition
placeholder + SymPy/Pyodide + `=` triggers a solve) — was **never actually
built**. Only Phase 1A (library/canvas infrastructure) existed. Inserted
Phase 1's math engine before Phase 3, since nothing in 3–6 is possible
without it. This isn't a judgment call Fahed needs to make; it's just what
has to exist first.

## Done this session

### Math engine (Phase 1) — DONE, tested, working end-to-end
- `src/math-engine/pythonSource.ts`: the actual SymPy logic, as a shared
  Python source string. Shared **verbatim** between the browser (loaded by
  `worker.ts` via Pyodide's CDN build) and the Vitest test bank (loaded via
  the `pyodide` npm package under Node) — one engine, two ways of running
  it, so the test bank proves the real app logic, not a mock.
  - `solve_steps(expr, var, notation)`: moves everything to one side; real
    step breakdowns for linear and quadratic (discriminant, formula);
    anything else falls back to `sympy.solve` with a step clearly marked
    `unverified_breakdown: true`. Every solution is checked by substituting
    random rational values back into the original equation
    (`verify_numeric`), not just trusted.
  - `diff_steps(expr, var, notation)`: a **real recursive step
    decomposer** (not one opaque `sympy.diff()` call) — sum rule, constant
    multiple, product rule, power rule, chain rule (including variable-base
    exponentials via logarithmic differentiation), and the common
    elementary functions (sin/cos/tan/exp/log/sqrt). Anything with no
    matching rule falls back to `sympy.diff` with `unverified_breakdown:
    true`. Verified against `sympy.diff` of the same expression, via
    `verify_equal_numeric` (symbolic check first, numeric substitution
    fallback — needed because SymPy's `simplify()` can't always collapse
    things like `sign(x)/Abs(x)` vs `1/x` on its own, see bug below).
  - `integrate_steps(expr, var, notation)`: real elementary rules (sum,
    constant multiple, power rule incl. `x**-1 -> ln|x|`, sin/cos/exp) with
    an honest fallback (`sympy.integrate` + `unverified_breakdown: true`)
    for anything else (e.g. a genuine product of two non-constant
    factors — no general product rule for integration exists). **Always**
    verified by differentiating the result and comparing to the original
    integrand — the one direction of calculus that's always mechanical, so
    this is a real check, not a guess.
  - `simplify_expr`, `plot_points` (ready for Phase 4's graphing).
- `src/math-engine/worker.ts`: runs Pyodide+SymPy in a Web Worker so a
  slow calculation never freezes the ink canvas. Loads Pyodide's **ESM**
  build (`pyodide.mjs`) via a dynamic `import()` from jsdelivr — see "Bugs
  found and fixed" below for why not `importScripts`.
- `src/math-engine/client.ts`: main-thread wrapper (`mathEngine` export).
  `solve`/`differentiate`/`integrate`/`simplify`/`plot`, each with a
  timeout (default 8s) that, on expiry, **terminates and respawns the
  worker** (Python can't be interrupted mid-call — this is the only real
  way to "cancel" a runaway calculation) and throws `EngineTimeoutError`.
  A `cancel()` method does the same on demand (the spec's Cancel button).
  `warmup()` is a *separate*, long-timeout (45s) call that must run once
  before any real calculation — see bug below for why.
- `src/math-engine/MathPanel.tsx`: the actual UI. Plain text expression
  input (not MathLive's editable keyboard yet — see "Still open"), a
  variable field, Solve/Differentiate/Integrate/Simplify mode buttons, a
  Cancel button while working, an "Ask AI instead" button on timeout (UI
  only — doesn't call Gemini yet, see "Still open"), and KaTeX-rendered
  steps with a verified/unverified/NOT-verified badge per solution.
  Wired into `PageScreen.tsx` via a new "Math" header button.
- **Verified live in the desktop browser preview** (not just unit tests):
  solved `x**2 - 5*x + 6 = 0` end to end (discriminant → formula → both
  roots marked "verified" in green); differentiated `x**3 * sin(x)` end to
  end (power rule, chain rule, product rule all shown as separate steps,
  correct final result `x**2*(x*cos(x) + 3*sin(x))`).
- **Not yet tablet-tested** — see TABLET-TESTS.md.

### Bugs found and fixed while building this (all confirmed via real tests, not guessed)
1. **Symbol identity mismatch (silent, would have broken almost
   everything)**: `_parse()` built its own generic `Symbol('x')` via the
   string parser, while every other function built `Symbol('x', real=True)`
   separately. SymPy treats these as two different symbols entirely, so
   `expr.has(var)` was always `False` — every derivative came back `0`,
   every "solve" returned zero solutions, silently, no exception. Fixed by
   threading the *same* real symbol into `_parse`'s `local_dict`. This is
   the kind of bug that would have looked like "it mostly doesn't work" in
   testing, not crashed — worth remembering for Phase 3–6 if similar
   "nothing happens" symptoms show up again.
2. **`log(Abs(x))` differentiated as if `x` could be complex**: without
   `real=True`, `diff(log(Abs(x)), x)` returns a mess involving `re(x)`/
   `im(x)` Wirtinger derivatives, because `Abs`/`sign` aren't holomorphic.
   This is *why* every variable symbol is built with `real=True` — not
   just a style choice, a correctness requirement for a math app that
   isn't doing complex analysis by default.
3. **Backticks inside Python docstrings broke the JS template literal**
   that holds `PY_SOURCE` (a literal `` ` `` inside a backtick-delimited
   string ends it early) — twice, caught both times by the Vite parse
   error, not silently. Rule for editing `pythonSource.ts` going forward:
   never put a literal backtick inside a Python string/comment there.
4. **`importScripts()` doesn't exist in a module worker, and a classic
   worker can't run a script containing `import` in Vite's *dev* server**
   (only the production build bundles it away) — so classic-vs-module was
   a real dead end either way. Fixed by keeping the worker a module worker
   and loading Pyodide's own ESM build (`pyodide.mjs`) via dynamic
   `import()` instead of `importScripts` + the classic build. Works
   identically in `npm run dev` and `npm run build`.
5. **Timeout counted Pyodide's one-time ~10MB cold-start download as part
   of the calculation time** — the very first calculation in any session
   would always "time out" even though nothing was actually slow. Fixed by
   splitting out `warmup()`: a separate, long-timeout, no-op-ish call
   (`simplify_expr('1')`) that the panel runs once on open, before any
   real button is clickable. The normal 8s timeout now only ever measures
   actual computation.
6. **`notation` (a plain JS object) crossed into Python as a `JsProxy`**,
   which has no `.get()` method — Python code calling
   `notation.get('imaginary')` threw. Fixed in `worker.ts` by converting
   object-typed args through `pyodide.toPy()` before calling the Python
   function, so Python receives a real `dict`.

### Test bank (Vitest) — 63 tests passing, real math, not mocked
- `tests/pyodideHarness.ts`: loads the exact same `PY_SOURCE` under Node
  via the `pyodide` npm package (pinned `0.29.5`, matching the CDN version
  the browser worker loads — see "notes" below on why this matters).
- `tests/math-engine.smoke.test.ts` + `tests/math-engine.algebra-calculus.test.ts`:
  10 linear equations, 10 quadratics (all roots numerically verified), 20
  derivatives (verified against `sympy.diff`), 15 integrals (verified by
  differentiating the result), 5 simplifications. **This is ~63 of the
  ~200 the spec asked for** — the full 200 spans series/stats/linear
  algebra/ODEs/electrical, which don't exist yet (Phase 6/5). Growing this
  alongside each new phase, not inventing low-quality filler cases now
  just to hit a number.
- `npm test` runs it (`vitest run`). Takes ~4–5s once Pyodide's wheels are
  cached in `node_modules` (first run downloads them from jsdelivr).

### Notation settings — DONE, tested
- `src/storage/db.ts`: `AppSettings` gained `imaginaryUnit` ('i'|'j',
  default 'i'), `eulerAsVariable` (default false — 'e' means Euler's
  number unless this is on), `implicitMultiplication` (default true),
  `electricalMode` (default false; toggling it on also sets the
  imaginary unit to 'j', toggling it off sets it back to 'i'). Additive,
  same pattern as every other settings field — old settings rows get the
  defaults when read.
- `SettingsScreen.tsx` gained a "Math notation" section with all four as
  segmented controls, wired straight to `updateSettings`.
- `pythonSource.ts`'s `_parse()` honours all of these: `imaginary`
  ('j'→'I' text substitution before parsing), `euler_as_variable` (maps
  bare `e` to a real free symbol instead of `sympy.E`), and
  `implicit_multiplication` (swaps the SymPy parser's transformation set
  so "2x" either parses as `2*x` or is a parse error, per the setting).
- **Bug found and fixed**: the exact same JsProxy/dict bug from the
  browser worker (see bug #6 above) was *also* present in
  `tests/pyodideHarness.ts` — it never got the `toPy()` conversion fix,
  so every test that passed a `notation` object was silently going to
  fail until now. Fixed identically. **Lesson: a fix made in one Pyodide
  call site doesn't automatically apply to the other — there are now two
  places (`worker.ts` for the browser, `pyodideHarness.ts` for tests)
  that each need this conversion; if a third one is ever added, remember
  this.**
- **Second bug found and fixed**: `_parse()` never actually mapped bare
  `e` to `sympy.E` in the *default* case (only in the `euler_as_variable`
  branch) — SymPy's parser does not recognise `e` as Euler's number on
  its own, so without an explicit `local_dict['e'] = sympy.E`, the
  "default" notation setting was silently broken (e` always behaved like
  a plain variable, the opposite of what unchecked-by-default was
  supposed to mean). Now explicit in both branches.
- `tests/math-engine.notation.test.ts`: 4 tests covering all four
  settings, all passing (67 tests total now).

### Phase 4 (started): graphing — DONE, tested, working end-to-end
- `MathPanel.tsx` gained a "Plot" mode: calls `mathEngine.plot()`
  (already existed, unused until now), renders the `{xs, ys}` points via
  `function-plot` as a polyline (feeding it pre-computed points rather
  than its own expression string, so there's no risk of its JS-expression
  syntax — `^` for power, etc. — disagreeing with SymPy's `**` syntax).
- **Verified live in the browser**: plotted `sin(x)`, got a correctly
  shaped sine curve.
- **Bug found and fixed**: `import functionPlot from 'function-plot'`
  resolved to an object, not a function — `function-plot`'s CJS output
  gets **double-wrapped** under Vite's dev-server ESM interop
  (`import * as ns` gives `{ default: { default: fn, Chart, ... } }`,
  not `{ default: fn }`). Confirmed by inspecting the actual loaded
  module in the browser console rather than guessing. Fixed with a small
  `unwrapDefault()` helper that peels off `.default` layers (up to 3)
  until it finds a function, instead of assuming a fixed wrapping depth.
- PDF import/export (`pdf-lib`/`pdfjs-dist`, installed, unused) — not
  started yet, next piece of Phase 4.

### Phase 5: electrical mode — DONE, tested, working end-to-end
- `pythonSource.ts` gained `convert_units(value, from_unit, to_unit)`
  (via Pint) and `impedance_rlc(resistance, inductance, capacitance,
  frequency_hz)` — series RLC impedance with a real step breakdown (R's
  contribution, X_L, X_C, the rectangular form, then magnitude/angle),
  verified by rebuilding the rectangular form from the polar result and
  comparing to the original.
- **Pint isn't a Pyodide built-in package** (confirmed by checking its
  package lock, not assumed) but is pure Python, so `worker.ts` and
  `pyodideHarness.ts` both now install it via `micropip` right after
  loading sympy, before `PY_SOURCE` runs.
- `client.ts` gained `impedanceRLC()` and `convertUnits()`.
  `MathPanel.tsx` gained an "Impedance" mode — only shown when
  `electricalMode` is on in Settings — with R/L/C/frequency number
  fields instead of the usual expression box, same verified-step display
  as everything else.
- **Bug found and fixed**: the impedance verification check compared
  against the **display-rounded** magnitude (6 significant figures)
  instead of full precision — for impedances in the tens/hundreds+, 6-sig-
  fig rounding error exceeds the 1e-6 check tolerance, so a *correct*
  answer could come back marked "NOT verified". Fixed by doing the
  verification arithmetic on the unrounded value and only rounding for
  the displayed/returned numbers. Caught by a capacitor-only test case
  (|Z|≈26.5 ohm) — worth remembering for any future `_steps` function:
  **never verify against an already-rounded display value.**
- Tests: 6 new (unit conversion x2, resistor-only/resonant/inductor-only/
  capacitor-only impedance) — 74 tests total now.
- **Verified live in the browser**: enabled Electrical mode in Settings,
  the "Impedance" button appeared, computed R=100Ω + L=0.01H at 60Hz,
  got the correct steps and a green "verified" result.
- **Not yet tablet-tested.**

### Phase 6: series, statistics, matrices, ODEs, Laplace (Stats + Matrix UI done, 3 left)
- `pythonSource.ts` gained 5 new functions, all tested, none wired into
  `MathPanel.tsx` yet (see "next up" below — 5 genuinely different input
  shapes, didn't want to rush low-quality UI for all of them in one go):
  - `series_steps(expr, var, about, order)` — term-by-term Taylor
    expansion (each `f^(n)(a)/n! * (x-a)^n` is its own step, not one
    opaque `sympy.series()` call), a ratio-test convergence estimate
    **explicitly marked as based only on the computed terms**, not a
    general proof, and a numeric closeness check near the expansion
    point (a series is only ever a local approximation, so this checks
    "close", not "equal").
  - `stats_summary(data)` — mean/median/variance/std with the textbook
    step sequence, variance cross-checked against the independent
    E[x²]−E[x]² formula (Bessel-corrected) rather than trusting one
    formula; handles n=1 without dividing by zero.
  - `matrix_steps(matrix, operation)` — determinant (cross-checked via
    cofactor expansion for ≤4×4), inverse (cross-checked via M·M⁻¹=I,
    rejects singular matrices with a clear error instead of a NaN/crash),
    eigenvalues (each one cross-checked via det(M−λI)=0).
  - `ode_solve(equation, func_name, var_name)` — lets the user write
    `y'' + y = 0` instead of SymPy's formal `Derivative(y(x), x, x)`
    syntax (a small preprocessor converts primes and bare function names);
    verified by substituting the solution back into the original ODE.
  - `laplace_transform_steps(expr, var, s)` — verified by taking the
    inverse transform and comparing to the original (mechanical check,
    same spirit as verifying integration by differentiating the result).
- **Two real bugs found and fixed, same root cause as the backtick bug
  from Step 1 of this session but for a different character**: both new
  regex patterns used single backslashes (`\w`, `\b`, `\s`, `\(`) written
  directly in `pythonSource.ts`. Since that whole file is a **JS template
  literal**, JS itself processes backslash escapes before Python ever
  sees the string — `\b` is JS's backspace escape (silently became
  `\x08`), and `\w`/`\s`/`\(` aren't recognized JS escapes so JS just
  **drops the backslash**, leaving literal `w`, `s`, `(`. The resulting
  regex was either silently wrong (matched literal "w" instead of
  `\w`-class — only didn't break the one test case by coincidence, since
  that particular input had no "w" to need `\w`) or a straight compile
  error (`missing ), unterminated subpattern` from the mangled
  lookahead). Found by tracing the actual runtime pattern string with a
  monkey-patched `re.sub`, not by guessing. **Rule, now proven twice over
  (backticks, now backslashes): any Python regex (or anything else using
  backslash escapes) written into `pythonSource.ts` needs every backslash
  doubled, because JS's template-literal escaping happens first.** Fixed
  by doubling the backslashes in both patterns (`\\w`, `\\b`, `\\s`,
  `\\(` in the TS source → `\w`, `\b`, `\s`, `\(` in the Python string
  Python actually receives).
- Tests: 12 new (series ×2, stats ×2, matrices ×4, ODEs ×2, Laplace ×2) —
  86 tests total now.
- **UI**: "Statistics" (comma-separated numbers) and "Matrix"
  (determinant/inverse/eigenvalues, a small textarea for rows) modes
  added to `MathPanel.tsx` — both verified live in the browser preview
  (dataset `2,4,4,4,5,5,7,9` → correct mean/median/variance/std, all
  green "verified"; `[[1,2],[3,4]]` determinant → -2, verified).
  **Update**: Series, ODE, and Laplace transform modes are now also
  wired in (same session, just after this was first written) — all 5
  Phase 6 functions have real UI. Series shows the term-by-term
  expansion + the convergence-ratio note; ODE has a function-name field
  and accepts `y''`/`y'` shorthand with a hint shown inline; Laplace
  reuses the generic expr+variable inputs. A generic "verified" badge
  was also added under the final boxed result for diff/integrate/ode/
  laplace (previously computed but never shown in the UI for those four).
  Verified live: Maclaurin series of `exp(x)` gave the correct
  `1 + x + x²/2 + x³/6 + x⁴/24 + x⁵/120`; `y'' + y` gave
  `y(x) = C₁sin(x) + C₂cos(x)`, both verified in green. Phase 6 UI is
  now fully done — all 5 functions have working, tested UI.

### "Check my work" mode — DONE, tested, working end-to-end

A deliberately **narrower** version than a full tutoring system (which
would need to recognise *which* algebra rule the student intended on
each line — flagged as the hard part in earlier planning). What's built
instead, and is genuinely useful on its own: `check_work(lines, var,
notation)` in `pythonSource.ts` checks each line against the one right
before it and flags the first one that isn't mathematically consistent.
- Two consecutive **equations** are consistent if they have the same
  solution set (compared numerically — exact symbolic equality of
  solution sets isn't reliable beyond simple polynomials).
- Two consecutive **plain expressions** (no `=`) are consistent if
  they're numerically equal (reuses `verify_equal_numeric`).
- A line that switches between the two (equation ↔ expression) is marked
  `unverifiable`, not wrongly flagged `wrong` — there's no sound way to
  compare them directly.
- **Bug found while writing the test bank, not a code bug**: Python's
  `None` crosses the Pyodide boundary as JS `undefined`, not `null`.
  `first_wrong_line` is `None` when nothing's wrong, so client-side code
  checking it must use `=== undefined`, not `=== null` — the tests
  originally asserted `null` and failed every "all correct" case until
  fixed. `client.ts`'s `CheckWorkResult.first_wrong_line` is typed
  `number | undefined` (not `| null`) to make this the obvious choice at
  the call site, not something to rediscover.
- UI: a new "Check my work" mode in `MathPanel.tsx` with a multi-line
  textarea instead of the usual single expression box; each line renders
  back with a status tag (starting line / follows OK / doesn't follow —
  check this / could not verify), the first wrong line's row highlighted
  red.
- Tests: 6 new (correct linear solve, correct simplification, caught
  arithmetic error, caught bad simplification, empty input rejected,
  equation→expression switch marked unverifiable not wrong) — 92 tests
  total now.
- **Verified live in the browser**: the default 3-line correct solve
  showed all green; deliberately breaking line 2 (`2*x = 7` instead of
  `2*x = 6`) correctly flagged it red — and also correctly flagged line 3
  (`x = 3`, which doesn't follow from the *wrong* `2*x = 7` either, since
  the right follow-on would be `x = 3.5`) — a good sign the check is
  really comparing consecutive lines, not just the final answer against
  some expected value.

## Phase 4: PDF/PNG export — DONE, tested, working end-to-end

Resumed after Fahed hit a usage limit and asked to continue. Built PDF
export first (export has no architectural impact on the already-stable
ink canvas; import does — see "next up" below for why that's separate).

- **Refactor first, to avoid duplicating stroke rendering**: extracted
  `applyCalligraphyAngle`, `applyPencilJitter`, and a new
  `strokeOutline()` (the full getStroke-with-pen-type-options pipeline)
  out of `InkCanvas.tsx` into a new `src/canvas/strokeGeometry.ts`, with
  no DOM dependency — it's pure geometry. Both the on-screen canvas
  renderer and the new PDF/PNG exporter now call the exact same function,
  so an export can never silently drift from what's actually on screen.
  Verified no regression: rebuilt, re-ran the full test suite, and drew a
  fresh stroke in the browser preview to confirm identical rendering.
  Also added `tests/strokeGeometry.test.ts` (6 tests, pure functions, no
  DOM/Dexie needed) — genuinely new coverage, not just a refactor safety
  net. 98 tests total now.
- New `src/canvas/pdfExport.ts`:
  - `exportPagePDF(pageId)` / `exportNotebookPDF(notebookId)`: real
    **vector** PDF via `pdf-lib`'s `drawSvgPath`, fed the exact same
    outline string `strokeOutline()` produces — not a rasterised
    screenshot. Page size fits the content (padded) or defaults to US
    Letter if empty, since our pages have no fixed size the way a
    physical sheet does.
  - **Scope limits, both deliberate, both documented in the file**: (1)
    the exported PDF includes ink + symbols only, not the page's
    background pattern/paper colour — adding that is more work than
    export needed for a first useful version. (2) Greek-letter/math-
    operator symbols are skipped per-symbol (caught, not fatal) when
    exporting text, because pdf-lib's built-in fonts only cover
    WinAnsiEncoding (Latin-ish) — rendering those correctly needs an
    embedded Unicode font, not done yet.
  - `exportPagePNG(pageId)`: renders through a real `<canvas>` (unlike
    the PDF path), so — unlike PDF export — it DOES include the
    background pattern and paper colour, since a PNG is a bitmap either
    way and there's no vector-fidelity reason to leave it out there.
- UI: `Toolbar.tsx`'s "⋮" overflow menu gained "Export page as PDF" /
  "Export page as PNG"; `NotebookScreen.tsx`'s header gained an "Export
  PDF" button for the whole notebook (all pages, in order, one PDF).
- **Verified live in the browser — not just "no error thrown"**: drew a
  stroke, exported the notebook as PDF, captured the actual blob (by
  temporarily intercepting `URL.createObjectURL`/`<a>.click()` rather
  than letting the real download fire), confirmed it's a valid
  `%PDF-1.7` file, then **rendered it back through pdf.js** into a
  canvas and screenshotted it — the rendered PDF page showed the exact
  same tapered stroke shape as the original. Did the same for PNG export
  (valid `image/png` blob, rendered `<img>` showed the matching stroke).
  This is a real round-trip check, not a size/type sniff.
- **Not yet tablet-tested.**

## In progress / next up, in order

1. Phase 4: PDF **import** (pdf.js, installed, unused) — PDF **export**
   is done, see below. Import is the architecturally bigger half: it
   needs to render an existing PDF page as a background layer under the
   ink in `InkCanvas.tsx` (a new rendering path, not the existing
   pattern system), plus a new Dexie table to hold the source PDF bytes
   per notebook. Deliberately not rushed in the same pass as export,
   since it touches the already-stable, heavily-tested ink canvas.
2. Phase 3 step-by-step: the engine already produces steps for solve/
   diff/integrate/series/etc.; this phase is mostly about *more* step
   coverage (more integration techniques — substitution, by parts — more
   equation types) and a nicer in-canvas UI than the current modal panel.
3. Phase 5 extras (basic series RLC + unit conversion already done):
   phasor addition/subtraction UI, parallel impedance, AC power
   calculations — only if these turn out to matter in practice.
5. Phase 2: offline recognition (ONNX + CoMER model, MathWriting dataset) —
   deliberately last per Fahed's reordering. Nothing started yet.
6. Phase 7 polish: full offline math (self-host Pyodide's wasm/data
   instead of the CDN — real work, not a toggle), code-split the >500KB
   JS chunk, real page-content thumbnails, remaining Tratto-comparison
   items (tags/search/favourites, consistent restyle of
   FolderScreen/NotebookScreen/TrashScreen).

## Needs Fahed (genuine decisions, not things I can resolve myself)

- **None yet.** Everything logged above as "not yet built" is just
  sequencing/time, not a decision only Fahed can make. This section exists
  for when one comes up — check back here before assuming something needs
  him.

## Known issues / honest limitations (not bugs, just real scope limits)

- Step-by-step coverage is real but not universal: anything outside the
  listed rules (sum/product/power/chain + common elementary functions for
  derivatives; sum/constant/power + sin/cos/exp for integrals; linear/
  quadratic for equations) falls back to a single SymPy call, clearly
  marked `unverified_breakdown: true` in the UI. This is honest, not
  broken — extending coverage is just more rules to add over time.
- Math currently needs a network connection the first time per session
  (Pyodide's ~10MB wheel set loads from jsdelivr, then the browser caches
  it). Full offline math is explicitly Phase 7, not assumed done now.
- The expression input is plain text (e.g. `x**2 + 3*x`), not MathLive's
  editable math keyboard (installed, not wired up) and not connected to
  ink recognition at all (that's Phase 2). Good enough to test the engine
  properly; not the final intended UX.
- "Ask AI instead" is UI-only right now — no Gemini request is actually
  sent on timeout yet.
- Build output warns about a >500KB JS chunk (KaTeX fonts + the engine
  client code). Not broken, just a Phase 7 code-splitting item.

## Tratto improvement pass (asked to be wrapped up first)

Everything judged "worth it" and reasonably self-contained was already
built in earlier sessions (see CLAUDE.md's "Improvement pass" section):
paper colours, pen types + realistic textures + the palm-rejection pan
fix, the Home-screen icon/folder-card redesign, the New Notebook dialog
(pattern/paper/spacing/margin line), the icon editor toolbar + page
counter + page overflow menu. Genuinely not finished: tags, search,
favourites, real page thumbnails, and restyling
FolderScreen/NotebookScreen/TrashScreen to match Home's new look — moved
into the Phase 7 polish list above rather than built now, since the math
engine was the far higher-priority blocking piece for the rest of this
session's instructions.

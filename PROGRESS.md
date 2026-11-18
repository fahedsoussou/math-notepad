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

### Notation settings (schema only so far)
- `src/storage/db.ts`: `AppSettings` gained `imaginaryUnit` ('i'|'j',
  default 'i'), `eulerAsVariable` (default false — 'e' means Euler's
  number unless this is on), `implicitMultiplication` (default true),
  `electricalMode` (default false, for Phase 5's 'j' default). Additive,
  same pattern as every other settings field — old settings rows get the
  defaults when read.
- The math engine's `_parse()` already honours `imaginary`/
  `euler_as_variable` (see `notation` param throughout `pythonSource.ts`).
- **Not yet wired into the Settings screen UI** — see "Needs Fahed" below,
  not because it needs a decision, just not built yet; next thing to do.

## In progress / next up, in order

1. Add a Notation section to `SettingsScreen.tsx` (i/j toggle, e toggle,
   implicit-multiplication toggle) — the schema and engine already support
   it, just needs the UI.
2. Wire `electricalMode` to default the imaginary unit to 'j' when it's on
   (Phase 5 will build the mode itself; this one default can go in now).
3. "Check my work" mode: user writes their solution line by line, app
   flags the first wrong line. Plan: a new input mode where each line is
   parsed and checked against the previous line via
   `verify_equal_numeric`-style substitution (is line N+1 actually implied
   by/equal to line N under the operation being performed) — needs some
   design thought on how to detect *which* operation the user intended
   per line (that's the hard part) before implementing.
4. Phase 3 step-by-step: the engine already produces steps; this phase is
   mostly about *more* step coverage (series expansion steps, more
   integration techniques — substitution, by parts — more equation types)
   and a nicer in-canvas UI than the current modal panel.
4. Phase 4: `function-plot` (installed, unused yet) for graphing
   `plot_points`'s output; `pdf-lib`/`pdfjs-dist` (installed, unused yet)
   for PDF import/export.
5. Phase 5: electrical mode — Pint for units (not installed yet), phasors,
   `j` as default imaginary unit.
6. Phase 6: series (with convergence-test steps), statistics (data table
   tool), matrices, ODEs, Laplace transforms — each needs its own
   `_steps`-style function in `pythonSource.ts` plus test-bank coverage.
7. Phase 2: offline recognition (ONNX + CoMER model, MathWriting dataset) —
   deliberately last per Fahed's reordering. Nothing started yet.
8. Phase 7 polish: full offline math (self-host Pyodide's wasm/data
   instead of the CDN — real work, not a toggle), real page-content
   thumbnails, remaining Tratto-comparison items (tags/search/favourites,
   consistent restyle of FolderScreen/NotebookScreen/TrashScreen).

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

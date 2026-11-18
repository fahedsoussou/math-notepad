/// <reference lib="webworker" />
// Runs SymPy (via Pyodide) off the main thread, so a heavy computation
// never freezes the ink canvas. Pyodide itself is loaded from a CDN at
// runtime, not bundled by Vite — bundling its wasm/data files through a
// normal bundler is unreliable, and this is the pattern Pyodide's own
// docs recommend for browser use. This means solving math needs a network
// connection the first time (cached by the browser after); full offline
// math is a Phase 7 polish item, tracked in PROGRESS.md.
//
// This must stay a MODULE worker (the `{ type: 'module' }` passed when
// constructing it in client.ts) because this file itself uses `import`.
// Pyodide's classic-script build (loaded via `importScripts`) only works
// in a classic worker, which can't run a script containing `import` at
// all in Vite's dev server (only the production build bundles it away) —
// so this uses Pyodide's ESM build (`pyodide.mjs`) via a dynamic `import()`
// instead, which works identically in dev and in the production build.
import { PY_SOURCE } from './pythonSource'

const PYODIDE_VERSION = '0.29.5'

let pyodideReady: Promise<any> | null = null

async function getPyodide() {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      const indexURL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
      const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)
      const pyodide = await loadPyodide({ indexURL })
      await pyodide.loadPackage(['sympy', 'micropip'])
      // Pint (Phase 5, electrical mode's unit conversion) isn't a Pyodide
      // built-in package, but it's pure Python, so micropip installs it
      // from PyPI like pip would.
      const micropip = pyodide.pyimport('micropip')
      await micropip.install('pint')
      pyodide.runPython(PY_SOURCE)
      return pyodide
    })()
  }
  return pyodideReady
}

export interface EngineRequest {
  id: number
  fn:
    | 'solve_steps'
    | 'diff_steps'
    | 'integrate_steps'
    | 'simplify_expr'
    | 'plot_points'
    | 'impedance_rlc'
    | 'convert_units'
    | 'stats_summary'
    | 'matrix_steps'
  args: unknown[]
}

export interface EngineResponse {
  id: number
  result?: unknown
  error?: string
}

self.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const { id, fn, args } = e.data
  try {
    const pyodide = await getPyodide()
    const pyFn = pyodide.globals.get(fn)
    // Plain JS objects (e.g. `notation`) cross into Python as a JsProxy by
    // default, which has no dict methods like .get() — the Python side
    // expects a real dict. toPy() converts recursively; primitives and
    // undefined pass through unchanged.
    const pyArgs = args.map((a) => (a && typeof a === 'object' ? pyodide.toPy(a) : a))
    const pyResult = pyFn(...pyArgs)
    const result = pyResult.toJs({ dict_converter: Object.fromEntries })
    pyResult.destroy()
    const response: EngineResponse = { id, result }
    ;(self as unknown as Worker).postMessage(response)
  } catch (err) {
    const response: EngineResponse = { id, error: err instanceof Error ? err.message : String(err) }
    ;(self as unknown as Worker).postMessage(response)
  }
}

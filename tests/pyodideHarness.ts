// Loads the real math-engine Python source under Node (via the `pyodide`
// npm package) so the Vitest test bank exercises the exact same code the
// browser Worker runs — not a mock. Loaded once and reused across all
// test files (loading Pyodide + sympy takes a few seconds).
import { loadPyodide, type PyodideInterface } from 'pyodide'
import { PY_SOURCE } from '../src/math-engine/pythonSource'

let pyodidePromise: Promise<PyodideInterface> | null = null

export function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const pyodide = await loadPyodide()
      await pyodide.loadPackage(['sympy', 'micropip'])
      const micropip = pyodide.pyimport('micropip')
      await micropip.install('pint')
      pyodide.runPython(PY_SOURCE)
      return pyodide
    })()
  }
  return pyodidePromise
}

/** Calls a Python function defined in PY_SOURCE and returns a plain JS
 * value (dicts/lists round-tripped via toJs with dict_converter: Object). */
export async function callEngine<T = any>(fnName: string, ...args: unknown[]): Promise<T> {
  const pyodide = await getPyodide()
  const fn = pyodide.globals.get(fnName)
  // Same conversion as worker.ts: a plain JS object crosses as a JsProxy
  // (no dict methods like .get()) unless explicitly converted — the
  // Python side expects a real dict.
  const pyArgs = args.map((a) => (a && typeof a === 'object' ? pyodide.toPy(a) : a))
  const result = fn(...pyArgs)
  const js = result.toJs({ dict_converter: Object.fromEntries })
  result.destroy()
  return js as T
}

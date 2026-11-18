// Main-thread wrapper around the math-engine Web Worker: turns the raw
// postMessage protocol into Promises, and implements the timeout + Cancel
// + respawn behaviour the spec asked for. Pyodide/Python can't be
// interrupted mid-call, so "cancel" here means terminating the worker
// outright and spawning a fresh one for the next request — the only way
// to actually stop a runaway computation.
import type { EngineRequest, EngineResponse } from './worker'

export class EngineTimeoutError extends Error {
  constructor() {
    super('The calculation took too long and was cancelled.')
    this.name = 'EngineTimeoutError'
  }
}

export class EngineCancelledError extends Error {
  constructor() {
    super('Cancelled.')
    this.name = 'EngineCancelledError'
  }
}

export interface NotationSettings {
  imaginary?: 'i' | 'j'
  euler_as_variable?: boolean
}

const DEFAULT_TIMEOUT_MS = 8000

class MathEngineClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<EngineResponse>) => {
        const { id, result, error } = e.data
        const p = this.pending.get(id)
        if (!p) return
        this.pending.delete(id)
        if (error) p.reject(new Error(error))
        else p.resolve(result)
      }
      this.worker = worker
    }
    return this.worker
  }

  private call<T>(fn: EngineRequest['fn'], args: unknown[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        this.worker?.terminate()
        this.worker = null
        reject(new EngineTimeoutError())
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      worker.postMessage({ id, fn, args } satisfies EngineRequest)
    })
  }

  /** User-triggered Cancel button: stop whatever's running right now. */
  cancel() {
    this.worker?.terminate()
    this.worker = null
    for (const [, p] of this.pending) p.reject(new EngineCancelledError())
    this.pending.clear()
  }

  /** Loads Pyodide + sympy in the worker, ignoring the usual short timeout
   * — the one-time ~10MB download/boot has nothing to do with how long an
   * actual calculation takes, so it must never count against it (every
   * first calculation in a session would otherwise "time out" while the
   * engine was simply still downloading, which is not a real problem and
   * would wrongly offer "Ask AI" for what's just a normal cold start).
   * Call this as soon as a math UI opens, before the user picks anything. */
  warmup(timeoutMs = 45000) {
    return this.call<SimplifyResult>('simplify_expr', ['1', undefined], timeoutMs)
  }

  solve(expr: string, varName = 'x', notation?: NotationSettings, timeoutMs?: number) {
    return this.call<SolveResult>('solve_steps', [expr, varName, notation], timeoutMs)
  }
  differentiate(expr: string, varName = 'x', notation?: NotationSettings, timeoutMs?: number) {
    return this.call<DiffResult>('diff_steps', [expr, varName, notation], timeoutMs)
  }
  integrate(expr: string, varName = 'x', notation?: NotationSettings, timeoutMs?: number) {
    return this.call<IntegrateResult>('integrate_steps', [expr, varName, notation], timeoutMs)
  }
  simplify(expr: string, notation?: NotationSettings, timeoutMs?: number) {
    return this.call<SimplifyResult>('simplify_expr', [expr, notation], timeoutMs)
  }
  plot(expr: string, varName = 'x', xMin = -10, xMax = 10, samples = 200, notation?: NotationSettings, timeoutMs?: number) {
    return this.call<PlotResult>('plot_points', [expr, varName, xMin, xMax, samples, notation], timeoutMs)
  }
}

export interface ExprFmt {
  latex: string
  text: string
}
export interface EngineStep {
  text: string
  expr?: ExprFmt
  unverified_breakdown?: boolean
}
export interface SolveResult {
  ok: boolean
  error?: string
  steps?: EngineStep[]
  solutions?: { solution: ExprFmt; verified: boolean | null }[]
}
export interface DiffResult {
  ok: boolean
  error?: string
  steps?: EngineStep[]
  result?: ExprFmt
  verified?: boolean | null
}
export interface IntegrateResult extends DiffResult {
  unverified_breakdown?: boolean
}
export interface SimplifyResult {
  ok: boolean
  error?: string
  steps?: EngineStep[]
  result?: ExprFmt
}
export interface PlotResult {
  ok: boolean
  error?: string
  xs?: number[]
  ys?: number[]
}

export const mathEngine = new MathEngineClient()

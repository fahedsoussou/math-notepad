import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import * as functionPlotModule from 'function-plot'
// function-plot's CJS/ESM interop double-wraps under Vite: `import * as`
// gives { default: { default: fn, Chart, ... } }, not { default: fn } —
// unwrap however many `.default` layers it takes to reach an actual
// function, rather than assuming a fixed depth.
function unwrapDefault(mod: unknown): (opts: Record<string, unknown>) => unknown {
  let candidate = mod
  for (let i = 0; i < 3 && typeof candidate !== 'function'; i++) {
    candidate = (candidate as { default?: unknown })?.default
  }
  return candidate as (opts: Record<string, unknown>) => unknown
}
const functionPlot = unwrapDefault(functionPlotModule)
import { getSettings, DEFAULT_SETTINGS } from '../storage/db'
import { mathEngine, EngineTimeoutError, type EngineStep, type CheckWorkResult } from './client'
import { ACCENT } from '../library/styles'

interface Props {
  onClose: () => void
}

type Mode = 'solve' | 'diff' | 'integrate' | 'simplify' | 'plot' | 'impedance' | 'stats' | 'matrix' | 'series' | 'ode' | 'laplace' | 'checkwork'

const MODE_LABELS: Record<Mode, string> = {
  solve: 'Solve',
  diff: 'Differentiate',
  integrate: 'Integrate',
  simplify: 'Simplify',
  plot: 'Plot',
  impedance: 'Impedance',
  stats: 'Statistics',
  matrix: 'Matrix',
  series: 'Series',
  ode: 'ODE',
  laplace: 'Laplace',
  checkwork: 'Check my work',
}

type MatrixOp = 'determinant' | 'inverse' | 'eigenvalues'
const MATRIX_OP_LABELS: Record<MatrixOp, string> = {
  determinant: 'Determinant',
  inverse: 'Inverse',
  eigenvalues: 'Eigenvalues',
}

function Katex({ latex, text }: { latex?: string; text: string }) {
  if (!latex) return <span>{text}</span>
  try {
    return <span dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { throwOnError: false }) }} />
  } catch {
    return <span>{text}</span>
  }
}

/**
 * Phase 1 math-engine panel: type an expression, pick an operation, see
 * verified step-by-step results. Plain text input for now (not MathLive's
 * editable keyboard yet, and not wired to ink recognition — that's
 * Phase 2) — see PROGRESS.md for what's next here.
 */
export default function MathPanel({ onClose }: Props) {
  const settings = useLiveQuery(() => getSettings(), []) ?? DEFAULT_SETTINGS
  const [expr, setExpr] = useState('')
  const [varName, setVarName] = useState('x')
  const [mode, setMode] = useState<Mode>('solve')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [steps, setSteps] = useState<EngineStep[] | null>(null)
  const [solutions, setSolutions] = useState<{ solution: { latex: string; text: string }; verified: boolean | null }[] | null>(null)
  const [finalResult, setFinalResult] = useState<{ latex: string; text: string } | null>(null)
  const [finalVerified, setFinalVerified] = useState<boolean | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [plotData, setPlotData] = useState<{ xs: number[]; ys: number[] } | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [resistance, setResistance] = useState('100')
  const [inductance, setInductance] = useState('0')
  const [capacitance, setCapacitance] = useState('0')
  const [frequencyHz, setFrequencyHz] = useState('60')
  const [impedanceResult, setImpedanceResult] = useState<{
    rectangular: { real: number; imag: number }
    polar: { magnitude: number; angle_deg: number }
    verified: boolean
  } | null>(null)
  const [statsInput, setStatsInput] = useState('2, 4, 4, 4, 5, 5, 7, 9')
  const [statsResult, setStatsResult] = useState<{ mean: number; median: number; variance: number; std_dev: number; verified: boolean } | null>(
    null,
  )
  const [matrixInput, setMatrixInput] = useState('1, 2\n3, 4')
  const [matrixOp, setMatrixOp] = useState<MatrixOp>('determinant')
  const [matrixResult, setMatrixResult] = useState<{
    text: string
    verified: boolean
    eigenvalues?: { value: { text: string }; multiplicity: number; verified: boolean }[]
  } | null>(null)
  const [seriesAbout, setSeriesAbout] = useState('0')
  const [seriesOrder, setSeriesOrder] = useState('5')
  const [seriesResult, setSeriesResult] = useState<{
    verified: boolean | null
    convergenceRatio: number | null
  } | null>(null)
  const [odeFuncName, setOdeFuncName] = useState('y')
  const [checkWorkInput, setCheckWorkInput] = useState('2*x + 4 = 10\n2*x = 6\nx = 3')
  const [checkWorkResult, setCheckWorkResult] = useState<CheckWorkResult['lines'] | null>(null)

  const availableModes = (Object.keys(MODE_LABELS) as Mode[]).filter((m) => m !== 'impedance' || settings.electricalMode)

  useEffect(() => {
    if (!plotData || !plotRef.current) return
    plotRef.current.innerHTML = ''
    try {
      functionPlot({
        target: plotRef.current,
        width: 420,
        height: 260,
        data: [
          {
            points: plotData.xs.map((x, i) => [x, plotData.ys[i]]) as [number, number][],
            fnType: 'points',
            graphType: 'polyline',
          },
        ],
      })
    } catch {
      // function-plot can throw on a degenerate point set (e.g. all NaN
      // filtered out) — leave the panel showing the steps/error already
      // set rather than crash the whole panel over a graph that can't render.
    }
  }, [plotData])

  useEffect(() => {
    let cancelled = false
    mathEngine
      .warmup()
      .then(() => {
        if (!cancelled) setEngineReady(true)
      })
      .catch((err) => {
        if (!cancelled) setEngineError(err instanceof Error ? err.message : 'Could not start the math engine.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const notation = {
    imaginary: settings.imaginaryUnit ?? 'i',
    euler_as_variable: settings.eulerAsVariable ?? false,
    implicit_multiplication: settings.implicitMultiplication ?? true,
  }

  const needsExpr = mode !== 'impedance' && mode !== 'stats' && mode !== 'matrix' && mode !== 'checkwork'

  const run = async () => {
    if (needsExpr && !expr.trim()) return
    setLoading(true)
    setError(null)
    setTimedOut(false)
    setSteps(null)
    setSolutions(null)
    setFinalResult(null)
    setFinalVerified(null)
    setPlotData(null)
    setImpedanceResult(null)
    setStatsResult(null)
    setMatrixResult(null)
    setSeriesResult(null)
    setCheckWorkResult(null)
    try {
      if (mode === 'checkwork') {
        const lines = checkWorkInput.split('\n').filter((l) => l.trim())
        if (lines.length === 0) {
          setError('Write at least one line.')
        } else {
          const r = await mathEngine.checkWork(lines, varName, notation)
          if (!r.ok || !r.lines) setError(r.error ?? 'Could not check this.')
          else setCheckWorkResult(r.lines)
        }
      } else if (mode === 'series') {
        const r = await mathEngine.series(expr, varName, Number(seriesAbout) || 0, Math.max(1, Math.min(12, Number(seriesOrder) || 5)), notation)
        if (!r.ok || !r.polynomial) setError(r.error ?? 'Could not expand this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.polynomial)
          setSeriesResult({ verified: r.verified ?? null, convergenceRatio: r.convergence?.ratio_last_two_terms ?? null })
        }
      } else if (mode === 'ode') {
        const r = await mathEngine.solveOde(expr, odeFuncName, varName, notation)
        if (!r.ok || !r.result) setError(r.error ?? "Could not solve this. Try writing derivatives as y' or y''.")
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result)
          setFinalVerified(r.verified ?? null)
        }
      } else if (mode === 'laplace') {
        const r = await mathEngine.laplaceTransform(expr, varName, 's', notation)
        if (!r.ok || !r.result) setError(r.error ?? 'Could not transform this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result)
          setFinalVerified(r.verified ?? null)
        }
      } else if (mode === 'stats') {
        const data = statsInput
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !Number.isNaN(n))
        if (data.length === 0) {
          setError('Enter at least one number, separated by commas.')
        } else {
          const r = await mathEngine.statsSummary(data)
          if (!r.ok || r.mean === undefined) setError(r.error ?? 'Could not compute this.')
          else {
            setSteps((r.steps ?? []).map((s) => ({ text: s.text })))
            setStatsResult({ mean: r.mean, median: r.median!, variance: r.variance!, std_dev: r.std_dev!, verified: r.verified ?? false })
          }
        }
      } else if (mode === 'matrix') {
        try {
          const rows = matrixInput
            .trim()
            .split('\n')
            .map((line) => line.split(',').map((s) => Number(s.trim())))
          if (rows.some((row) => row.some((n) => Number.isNaN(n)))) throw new Error('bad')
          const r = await mathEngine.matrixSteps(rows, matrixOp)
          if (!r.ok) setError(r.error ?? 'Could not compute this.')
          else {
            setSteps((r.steps ?? []).map((s) => ({ text: s.text })))
            if (matrixOp === 'eigenvalues') {
              setMatrixResult({
                text: (r.eigenvalues ?? []).map((e) => `${e.value.text} (x${e.multiplicity})`).join(', '),
                verified: r.verified ?? false,
                eigenvalues: r.eigenvalues,
              })
            } else {
              setMatrixResult({ text: r.result?.text ?? '', verified: r.verified ?? false })
            }
          }
        } catch {
          setError('Enter rows of numbers separated by commas, one row per line — e.g. "1, 2" then "3, 4".')
        }
      } else if (mode === 'impedance') {
        const r = await mathEngine.impedanceRLC(Number(resistance) || 0, Number(inductance) || 0, Number(capacitance) || 0, Number(frequencyHz) || 0)
        if (!r.ok || !r.rectangular || !r.polar) setError(r.error ?? 'Could not compute this.')
        else {
          setSteps((r.steps ?? []).map((s) => ({ text: s.text })))
          setImpedanceResult({ rectangular: r.rectangular, polar: r.polar, verified: r.verified ?? false })
        }
      } else if (mode === 'plot') {
        const r = await mathEngine.plot(expr, varName, -10, 10, 200, notation)
        if (!r.ok || !r.xs || !r.ys) setError(r.error ?? 'Could not plot this.')
        else if (r.xs.length === 0) setError('Nothing plottable in this range (try a different variable or range).')
        else setPlotData({ xs: r.xs, ys: r.ys })
      } else if (mode === 'solve') {
        const r = await mathEngine.solve(expr, varName, notation)
        if (!r.ok) setError(r.error ?? 'Could not solve this.')
        else {
          setSteps(r.steps ?? [])
          setSolutions(r.solutions ?? [])
        }
      } else if (mode === 'diff') {
        const r = await mathEngine.differentiate(expr, varName, notation)
        if (!r.ok) setError(r.error ?? 'Could not differentiate this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result ?? null)
          setFinalVerified(r.verified ?? null)
        }
      } else if (mode === 'integrate') {
        const r = await mathEngine.integrate(expr, varName, notation)
        if (!r.ok) setError(r.error ?? 'Could not integrate this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result ?? null)
          setFinalVerified(r.verified ?? null)
        }
      } else {
        const r = await mathEngine.simplify(expr, notation)
        if (!r.ok) setError(r.error ?? 'Could not simplify this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result ?? null)
        }
      }
    } catch (err) {
      if (err instanceof EngineTimeoutError) setTimedOut(true)
      else setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    mathEngine.cancel()
    setLoading(false)
  }

  const handleAskAI = async () => {
    if (!settings.geminiApiKey) {
      setError('Add a Gemini API key in Settings to use "Ask AI" for slow calculations.')
      return
    }
    setError('Ask AI is not wired up yet — the key is saved, but no request is sent. Coming soon.')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#1e1e2e',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Math</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: '#1e1e2e' }}>
            Close
          </button>
        </div>

        {mode === 'impedance' ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'R (ohm)', value: resistance, set: setResistance },
              { label: 'L (henry)', value: inductance, set: setInductance },
              { label: 'C (farad)', value: capacitance, set: setCapacitance },
              { label: 'f (Hz)', value: frequencyHz, set: setFrequencyHz },
            ].map((f) => (
              <label key={f.label} style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {f.label}
                <input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
                />
              </label>
            ))}
          </div>
        ) : mode === 'stats' ? (
          <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Numbers, separated by commas
            <input
              value={statsInput}
              onChange={(e) => setStatsInput(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d7dde5', fontSize: 15, fontFamily: 'monospace', background: 'white', color: '#1e1e2e' }}
            />
          </label>
        ) : mode === 'checkwork' ? (
          <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Your work, one step per line
            <textarea
              value={checkWorkInput}
              onChange={(e) => setCheckWorkInput(e.target.value)}
              rows={5}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d7dde5', fontSize: 15, fontFamily: 'monospace', background: 'white', color: '#1e1e2e', resize: 'vertical' }}
            />
          </label>
        ) : mode === 'matrix' ? (
          <>
            <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
              One row per line, numbers separated by commas
              <textarea
                value={matrixInput}
                onChange={(e) => setMatrixInput(e.target.value)}
                rows={3}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d7dde5', fontSize: 15, fontFamily: 'monospace', background: 'white', color: '#1e1e2e', resize: 'vertical' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(MATRIX_OP_LABELS) as MatrixOp[]).map((op) => (
                <button
                  key={op}
                  onClick={() => setMatrixOp(op)}
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: matrixOp === op ? ACCENT : '#e6eaf0',
                    color: matrixOp === op ? 'white' : '#1e1e2e',
                  }}
                >
                  {MATRIX_OP_LABELS[op]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="e.g. x**2 - 5*x + 6 = 0"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d7dde5',
                fontSize: 16,
                fontFamily: 'monospace',
                background: 'white',
                color: '#1e1e2e',
              }}
            />

            {mode !== 'simplify' && (
              <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}>
                Variable
                <input
                  value={varName}
                  onChange={(e) => setVarName(e.target.value || 'x')}
                  style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
                />
              </label>
            )}

            {mode === 'series' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                  About x =
                  <input
                    value={seriesAbout}
                    onChange={(e) => setSeriesAbout(e.target.value)}
                    style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
                  />
                </label>
                <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Order
                  <input
                    value={seriesOrder}
                    onChange={(e) => setSeriesOrder(e.target.value)}
                    style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
                  />
                </label>
              </div>
            )}

            {mode === 'ode' && (
              <div style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Function name
                  <input
                    value={odeFuncName}
                    onChange={(e) => setOdeFuncName(e.target.value || 'y')}
                    style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
                  />
                </label>
                <div>Write derivatives with primes, e.g. {odeFuncName}'' + {odeFuncName} = 0</div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {availableModes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 14,
                cursor: 'pointer',
                background: mode === m ? ACCENT : '#e6eaf0',
                color: mode === m ? 'white' : '#1e1e2e',
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {!engineReady && !engineError && (
          <div style={{ fontSize: 13, color: '#4b5563' }}>Starting the math engine… (first time only, needs a connection)</div>
        )}
        {engineError && <div style={{ fontSize: 13, color: '#9b1c1c' }}>{engineError}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={run}
            disabled={loading || (needsExpr && !expr.trim()) || !engineReady}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 15,
              cursor: loading ? 'default' : 'pointer',
              background: ACCENT,
              color: 'white',
              opacity: loading || (needsExpr && !expr.trim()) || !engineReady ? 0.6 : 1,
            }}
          >
            {loading ? 'Working…' : MODE_LABELS[mode]}
          </button>
          {loading && (
            <button
              onClick={handleCancel}
              style={{ border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 15, cursor: 'pointer', background: '#fde2e2', color: '#9b1c1c' }}
            >
              Cancel
            </button>
          )}
        </div>

        {timedOut && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 12, fontSize: 14 }}>
            This is taking too long, so it was stopped.{' '}
            <button onClick={handleAskAI} style={{ border: 'none', background: ACCENT, color: 'white', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Ask AI instead
            </button>
          </div>
        )}

        {error && <div style={{ color: '#9b1c1c', fontSize: 14 }}>{error}</div>}

        {steps && steps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>Steps</div>
            {steps.map((s, i) => (
              <div key={i} style={{ padding: 10, borderRadius: 8, background: '#f4f6f9', border: '1px solid #e6eaf0' }}>
                <div style={{ fontSize: 13, color: '#4b5563' }}>
                  {s.text}
                  {s.unverified_breakdown && <span style={{ color: '#b45309' }}> (no full breakdown for this form)</span>}
                </div>
                {s.expr && (
                  <div style={{ fontSize: 16, marginTop: 4 }}>
                    <Katex latex={s.expr.latex} text={s.expr.text} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {solutions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>Solutions</div>
            {solutions.map((s, i) => (
              <div key={i} style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Katex latex={s.solution.latex} text={s.solution.text} />
                <span style={{ fontSize: 12, color: s.verified === true ? '#16a34a' : s.verified === false ? '#9b1c1c' : '#b45309' }}>
                  {s.verified === true ? 'verified' : s.verified === false ? 'NOT verified — check this' : 'unverified'}
                </span>
              </div>
            ))}
          </div>
        )}

        {finalResult && (
          <div style={{ fontSize: 18, padding: 10, borderRadius: 8, background: '#eef3fb' }}>
            <Katex latex={finalResult.latex} text={finalResult.text} />
            {finalVerified !== null && (
              <div style={{ fontSize: 12, marginTop: 4, color: finalVerified ? '#16a34a' : '#9b1c1c' }}>
                {finalVerified ? 'verified' : 'NOT verified — check this'}
              </div>
            )}
          </div>
        )}

        {seriesResult && (
          <div style={{ fontSize: 13, color: '#4b5563' }}>
            {seriesResult.convergenceRatio !== null && (
              <div>Ratio of the last two computed terms: {seriesResult.convergenceRatio.toFixed(4)} (below 1 suggests convergence near this point — based only on the terms shown above, not a general proof)</div>
            )}
          </div>
        )}

        {mode === 'plot' && <div ref={plotRef} style={{ display: plotData ? 'block' : 'none' }} />}

        {impedanceResult && (
          <div style={{ fontSize: 16, padding: 10, borderRadius: 8, background: '#eef3fb', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              Z = {impedanceResult.rectangular.real.toFixed(4)} {impedanceResult.rectangular.imag >= 0 ? '+' : '-'}{' '}
              {Math.abs(impedanceResult.rectangular.imag).toFixed(4)}j ohm
            </div>
            <div>
              |Z| = {impedanceResult.polar.magnitude.toFixed(4)} ohm at {impedanceResult.polar.angle_deg.toFixed(2)} degrees
            </div>
            <span style={{ fontSize: 12, color: impedanceResult.verified ? '#16a34a' : '#9b1c1c' }}>
              {impedanceResult.verified ? 'verified' : 'NOT verified — check this'}
            </span>
          </div>
        )}

        {statsResult && (
          <div style={{ fontSize: 16, padding: 10, borderRadius: 8, background: '#eef3fb', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Mean = {statsResult.mean.toFixed(4)}, Median = {statsResult.median.toFixed(4)}</div>
            <div>
              Variance = {statsResult.variance.toFixed(4)}, Std dev = {statsResult.std_dev.toFixed(4)}
            </div>
            <span style={{ fontSize: 12, color: statsResult.verified ? '#16a34a' : '#9b1c1c' }}>
              {statsResult.verified ? 'verified' : 'NOT verified — check this'}
            </span>
          </div>
        )}

        {matrixResult && (
          <div style={{ fontSize: 16, padding: 10, borderRadius: 8, background: '#eef3fb', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ wordBreak: 'break-word' }}>{matrixResult.text}</div>
            <span style={{ fontSize: 12, color: matrixResult.verified ? '#16a34a' : '#9b1c1c' }}>
              {matrixResult.verified ? 'verified' : 'NOT verified — check this'}
            </span>
          </div>
        )}

        {checkWorkResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {checkWorkResult.map((l, i) => {
              const color = l.status === 'wrong' ? '#9b1c1c' : l.status === 'ok' ? '#16a34a' : l.status === 'start' ? '#4b5563' : '#b45309'
              const bg = l.status === 'wrong' ? '#fde2e2' : '#f4f6f9'
              return (
                <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: bg, fontFamily: 'monospace', fontSize: 15, color: '#1e1e2e' }}>
                  {l.line}
                  <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'sans-serif', color }}>
                    {l.status === 'start' ? 'starting line' : l.status === 'ok' ? 'follows OK' : l.status === 'wrong' ? "doesn't follow — check this" : 'could not verify'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

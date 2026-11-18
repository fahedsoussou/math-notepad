import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { getSettings, DEFAULT_SETTINGS } from '../storage/db'
import { mathEngine, EngineTimeoutError, type EngineStep } from './client'
import { ACCENT } from '../library/styles'

interface Props {
  onClose: () => void
}

type Mode = 'solve' | 'diff' | 'integrate' | 'simplify'

const MODE_LABELS: Record<Mode, string> = {
  solve: 'Solve',
  diff: 'Differentiate',
  integrate: 'Integrate',
  simplify: 'Simplify',
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
  const [engineReady, setEngineReady] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)

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

  const run = async () => {
    if (!expr.trim()) return
    setLoading(true)
    setError(null)
    setTimedOut(false)
    setSteps(null)
    setSolutions(null)
    setFinalResult(null)
    try {
      if (mode === 'solve') {
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
        }
      } else if (mode === 'integrate') {
        const r = await mathEngine.integrate(expr, varName, notation)
        if (!r.ok) setError(r.error ?? 'Could not integrate this.')
        else {
          setSteps(r.steps ?? [])
          setFinalResult(r.result ?? null)
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

        {(mode === 'solve' || mode === 'diff' || mode === 'integrate') && (
          <label style={{ fontSize: 13, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}>
            Variable
            <input
              value={varName}
              onChange={(e) => setVarName(e.target.value || 'x')}
              style={{ width: 48, padding: '4px 8px', borderRadius: 6, border: '1px solid #d7dde5', background: 'white', color: '#1e1e2e' }}
            />
          </label>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
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
            disabled={loading || !expr.trim() || !engineReady}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 15,
              cursor: loading ? 'default' : 'pointer',
              background: ACCENT,
              color: 'white',
              opacity: loading || !expr.trim() || !engineReady ? 0.6 : 1,
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
          </div>
        )}
      </div>
    </div>
  )
}

import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('plot_points', () => {
  it('plots sin(x)', async () => {
    const r = await callEngine('plot_points', 'sin(x)', 'x', -10, 10, 200, undefined)
    if (!r.ok) console.error(r.error, r.trace)
    expect(r.ok).toBe(true)
    expect(r.xs.length).toBeGreaterThan(0)
    expect(r.xs.length).toBe(r.ys.length)
  })
})

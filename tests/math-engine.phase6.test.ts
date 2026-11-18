import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('Phase 6: series', () => {
  it('Maclaurin series of exp(x) matches known coefficients', async () => {
    const r = await callEngine('series_steps', 'exp(x)', 'x', 0, 4)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.polynomial.text).toContain('x**4/24')
  })

  it('series of sin(x) about 0', async () => {
    const r = await callEngine('series_steps', 'sin(x)', 'x', 0, 5)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
  })
})

describe('Phase 6: statistics', () => {
  it('summarizes a simple dataset', async () => {
    const r = await callEngine('stats_summary', [2, 4, 4, 4, 5, 5, 7, 9])
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.mean).toBeCloseTo(5, 6)
  })

  it('handles a single value without dividing by zero', async () => {
    const r = await callEngine('stats_summary', [42])
    expect(r.ok).toBe(true)
    expect(r.mean).toBeCloseTo(42, 6)
  })
})

describe('Phase 6: matrices', () => {
  it('determinant of a 2x2', async () => {
    const r = await callEngine(
      'matrix_steps',
      [
        [1, 2],
        [3, 4],
      ],
      'determinant',
    )
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.result.text).toBe('-2')
  })

  it('inverse of a 2x2, verified via M*M_inv = I', async () => {
    const r = await callEngine(
      'matrix_steps',
      [
        [4, 7],
        [2, 6],
      ],
      'inverse',
    )
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
  })

  it('rejects a singular matrix for inverse', async () => {
    const r = await callEngine(
      'matrix_steps',
      [
        [1, 2],
        [2, 4],
      ],
      'inverse',
    )
    expect(r.ok).toBe(false)
  })

  it('eigenvalues of a diagonal matrix are the diagonal entries', async () => {
    const r = await callEngine(
      'matrix_steps',
      [
        [3, 0],
        [0, 5],
      ],
      'eigenvalues',
    )
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    const values = r.eigenvalues.map((e: any) => e.value.text).sort()
    expect(values).toEqual(['3', '5'])
  })
})

describe('Phase 6: ODEs', () => {
  it("solves y' = y (exponential growth)", async () => {
    const r = await callEngine('ode_solve', "y' - y", 'y', 'x')
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
  })

  it("solves y'' + y = 0 (simple harmonic)", async () => {
    const r = await callEngine('ode_solve', "y'' + y", 'y', 'x')
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
  })
})

describe('Phase 6: Laplace transforms', () => {
  it('L{1} = 1/s', async () => {
    const r = await callEngine('laplace_transform_steps', '1', 't', 's')
    expect(r.ok).toBe(true)
    expect(r.result.text).toBe('1/s')
  })

  it('L{exp(-a*t)} is verified by the inverse transform', async () => {
    const r = await callEngine('laplace_transform_steps', 'exp(-t)', 't', 's')
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
  })
})

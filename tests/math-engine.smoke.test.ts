import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('math engine smoke test', () => {
  it('solves a linear equation', async () => {
    const result = await callEngine('solve_steps', '2*x + 4 = 0')
    expect(result.ok).toBe(true)
    expect(result.solutions[0].verified).toBe(true)
  })

  it('differentiates a polynomial', async () => {
    const result = await callEngine('diff_steps', 'x**2 + 3*x')
    expect(result.ok).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.result.text).toBe('2*x + 3')
  })

  it('integrates a polynomial', async () => {
    const result = await callEngine('integrate_steps', 'x**2')
    expect(result.ok).toBe(true)
    expect(result.verified).toBe(true)
  })
})

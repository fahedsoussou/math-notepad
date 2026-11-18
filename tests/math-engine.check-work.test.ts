import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('check_work: correct solutions', () => {
  it('a correct linear solve, line by line', async () => {
    const r = await callEngine('check_work', ['2*x + 4 = 10', '2*x = 6', 'x = 3'])
    expect(r.ok).toBe(true)
    expect(r.first_wrong_line).toBeUndefined()
    expect(r.lines.map((l: any) => l.status)).toEqual(['start', 'ok', 'ok'])
  })

  it('a correct simplification chain', async () => {
    const r = await callEngine('check_work', ['(x+1)**2', 'x**2 + 2*x + 1'])
    expect(r.ok).toBe(true)
    expect(r.first_wrong_line).toBeUndefined()
  })
})

describe('check_work: catches the first mistake', () => {
  it('flags an arithmetic error on the second line', async () => {
    // 2x + 4 = 10 -> 2x = 7 is wrong (should be 6); the rest follows from
    // the wrong line consistently, so only line 1 (0-indexed) is flagged.
    const r = await callEngine('check_work', ['2*x + 4 = 10', '2*x = 7', 'x = 3.5'])
    expect(r.ok).toBe(true)
    expect(r.first_wrong_line).toBe(1)
    expect(r.lines[1].status).toBe('wrong')
    expect(r.lines[2].status).toBe('ok') // consistent with the (wrong) previous line
  })

  it('flags a bad simplification', async () => {
    const r = await callEngine('check_work', ['(x+1)**2', 'x**2 + 2*x + 2'])
    expect(r.ok).toBe(true)
    expect(r.first_wrong_line).toBe(1)
  })
})

describe('check_work: edge cases', () => {
  it('rejects an empty submission', async () => {
    const r = await callEngine('check_work', [])
    expect(r.ok).toBe(false)
  })

  it('marks a type change (equation to expression) as unverifiable, not wrong', async () => {
    const r = await callEngine('check_work', ['2*x + 4 = 10', 'x'])
    expect(r.ok).toBe(true)
    expect(r.lines[1].status).toBe('unverifiable')
    expect(r.first_wrong_line).toBeUndefined()
  })
})

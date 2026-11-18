import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('notation settings', () => {
  it('imaginary unit j parses as I (electrical mode)', async () => {
    const r = await callEngine('simplify_expr', '2 + 3*j - j', { imaginary: 'j' })
    expect(r.ok).toBe(true)
    expect(r.result.text).toContain('I')
  })

  it('euler_as_variable keeps e as a free symbol', async () => {
    const r = await callEngine('diff_steps', 'e*x', 'x', { euler_as_variable: true })
    expect(r.ok).toBe(true)
    expect(r.result.text).toBe('e')
  })

  it('e defaults to Euler’s number when not overridden', async () => {
    const r = await callEngine('simplify_expr', 'log(e)')
    expect(r.ok).toBe(true)
    expect(r.result.text).toBe('1')
  })

  it('implicit multiplication off requires explicit *', async () => {
    const onR = await callEngine('simplify_expr', '2x', undefined)
    expect(onR.ok).toBe(true) // "2x" parses fine with implicit multiplication (default)

    const offR = await callEngine('simplify_expr', '2x', { implicit_multiplication: false })
    expect(offR.ok).toBe(false) // same text should fail to parse without it
  })
})

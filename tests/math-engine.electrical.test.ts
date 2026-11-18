import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

describe('Phase 5: electrical mode', () => {
  it('converts units via Pint', async () => {
    const r = await callEngine('convert_units', 1000, 'milliampere', 'ampere')
    expect(r.ok).toBe(true)
    expect(r.value).toBeCloseTo(1, 6)
    expect(r.unit).toContain('ampere')
  })

  it('converts kilohm to ohm', async () => {
    const r = await callEngine('convert_units', 2.2, 'kiloohm', 'ohm')
    expect(r.ok).toBe(true)
    expect(r.value).toBeCloseTo(2200, 3)
  })

  it('resistor-only impedance equals the resistance, angle 0', async () => {
    const r = await callEngine('impedance_rlc', 100, 0, 0, 60)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.polar.magnitude).toBeCloseTo(100, 3)
    expect(r.polar.angle_deg).toBeCloseTo(0, 3)
  })

  it('series RLC at resonance (X_L = X_C) has zero reactance', async () => {
    // omega = 1/sqrt(LC) => resonance. L=1H, C=1F => omega=1 => f = 1/(2*pi)
    const freq = 1 / (2 * Math.PI)
    const r = await callEngine('impedance_rlc', 50, 1, 1, freq)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.rectangular.imag).toBeCloseTo(0, 3)
    expect(r.polar.magnitude).toBeCloseTo(50, 3)
  })

  it('inductor-only impedance has +90 degree angle', async () => {
    const r = await callEngine('impedance_rlc', 0, 0.01, 0, 60)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.polar.angle_deg).toBeCloseTo(90, 3)
  })

  it('capacitor-only impedance has -90 degree angle', async () => {
    const r = await callEngine('impedance_rlc', 0, 0, 0.0001, 60)
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.polar.angle_deg).toBeCloseTo(-90, 3)
  })
})

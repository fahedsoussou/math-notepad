import { describe, expect, it } from 'vitest'
import { strokeOutline } from '../src/canvas/strokeGeometry'

const STRAIGHT_LINE: [number, number, number][] = [
  [0, 0, 0.5],
  [10, 2, 0.5],
  [20, 4, 0.5],
  [30, 6, 0.5],
  [40, 8, 0.5],
]

describe('strokeOutline', () => {
  it('returns null for an empty stroke', () => {
    expect(strokeOutline([], 4, 'pen', 'fountain', 0.4)).toBeNull()
  })

  it('produces a non-empty SVG path for a pen stroke', () => {
    const result = strokeOutline(STRAIGHT_LINE, 8, 'pen', 'fountain', 0.4)
    expect(result).not.toBeNull()
    expect(result!.path.length).toBeGreaterThan(0)
    expect(result!.path.startsWith('M')).toBe(true)
    expect(result!.alpha).toBe(1)
  })

  it('highlighter strokes use the highlighter alpha, ignoring pen type', () => {
    const result = strokeOutline(STRAIGHT_LINE, 20, 'highlighter', undefined, 0.4)
    expect(result!.alpha).toBe(0.4)
  })

  it('pencil strokes render at reduced alpha', () => {
    const result = strokeOutline(STRAIGHT_LINE, 8, 'pen', 'pencil', 0.4)
    expect(result!.alpha).toBeLessThan(1)
  })

  it('calligraphy and the base stroke produce different outlines for a diagonal line', () => {
    const fountain = strokeOutline(STRAIGHT_LINE, 8, 'pen', 'fountain', 0.4)
    const calligraphy = strokeOutline(STRAIGHT_LINE, 8, 'pen', 'calligraphy', 0.4)
    // Direction-dependent width means the path geometry must differ.
    expect(calligraphy!.path).not.toBe(fountain!.path)
  })

  it('eraser/lasso tools are treated like the non-pen default (taper on, full alpha)', () => {
    const result = strokeOutline(STRAIGHT_LINE, 8, 'eraser', undefined, 0.4)
    expect(result!.alpha).toBe(1)
  })
})

import type { Stroke, PlacedSymbol } from '../storage/db'

/** Standard ray-casting point-in-polygon test, in page-space. */
export function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** A stroke is "inside" the lasso if any one of its points is — permissive,
 * like most freehand lasso tools (you don't have to fully encircle it). */
export function strokeInPolygon(stroke: Stroke, polygon: [number, number][]): boolean {
  return stroke.points.some(([x, y]) => pointInPolygon(x, y, polygon))
}

export function symbolInPolygon(symbol: PlacedSymbol, polygon: [number, number][]): boolean {
  return pointInPolygon(symbol.x, symbol.y, polygon)
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function polygonBounds(polygon: [number, number][]): Bounds | null {
  if (polygon.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

export function boundsContains(bounds: Bounds, px: number, py: number): boolean {
  return px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY
}

/** Bounding box of a selection (strokes + symbols), used for the move
 * hit-area and the dashed selection outline. */
export function selectionBounds(strokes: Stroke[], symbols: PlacedSymbol[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let any = false
  for (const s of strokes) {
    for (const [x, y] of s.points) {
      any = true
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  for (const sym of symbols) {
    any = true
    const half = sym.size / 2
    minX = Math.min(minX, sym.x - half)
    minY = Math.min(minY, sym.y - half)
    maxX = Math.max(maxX, sym.x + half)
    maxY = Math.max(maxY, sym.y + half)
  }
  return any ? { minX, minY, maxX, maxY } : null
}

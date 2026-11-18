// The stroke-outline geometry shared between canvas rendering
// (InkCanvas.tsx) and vector PDF export (pdfExport.ts) — one source of
// truth, so an exported PDF's ink shape always matches what's on screen,
// not a re-derived approximation. Extracted from InkCanvas.tsx (Steps
// C/G/H/I of the Tratto improvement pass built the per-pen-type feel
// this encodes).
import { getStroke } from 'perfect-freehand'
import { getSvgPathFromStroke } from './strokeToPath'
import { PEN_TYPES, PEN_TYPE_OPTIONS } from './colors'
import type { PenType } from '../storage/db'
import type { Tool } from './InkCanvas'

export type PagePoint = [number, number, number] // x, y, pressure — all in page-space

/** Chisel-nib feel: width (via synthetic pressure) depends on stroke
 * direction relative to a fixed nib angle, like a real calligraphy pen. */
export function applyCalligraphyAngle(points: PagePoint[]): PagePoint[] {
  const NIB_ANGLE = Math.PI / 4
  return points.map(([x, y, pressure], i) => {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const angle = Math.atan2(next[1] - prev[1], next[0] - prev[0])
    const factor = 0.12 + 0.88 * Math.abs(Math.sin(angle - NIB_ANGLE))
    return [x, y, pressure * factor]
  })
}

/** Nudges each point slightly sideways off the stroke's own direction, by a
 * deterministic pseudo-random amount (same input points always jitter the
 * same way, so repeated repaints/exports of a committed stroke don't
 * visibly wobble) — a real pencil line is never perfectly smooth the way
 * perfect-freehand's curve fit otherwise makes it look. */
export function applyPencilJitter(points: PagePoint[], size: number): PagePoint[] {
  const amplitude = size * 0.08
  return points.map(([x, y, pressure], i) => {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const n = Math.sin(i * 12.9898) * 43758.5453
    const jitter = (n - Math.floor(n) - 0.5) * 2 * amplitude
    return [x + nx * jitter, y + ny * jitter, pressure]
  })
}

/** Computes the filled-outline SVG path ("d" attribute) for a stroke,
 * honouring the same per-pen-type taper/calligraphy/jitter behaviour used
 * on screen. Returns the path string and the alpha the fill should use
 * (highlighter transparency, or a pen type's own alpha). Does NOT include
 * the pencil grain texture — that's a raster (canvas pixel) effect with no
 * vector equivalent, applied separately by the canvas renderer only; PDF
 * export omits it (documented limitation, not a bug). */
export function strokeOutline(
  points: PagePoint[],
  size: number,
  tool: Tool,
  penType: PenType | undefined,
  highlighterAlpha: number,
): { path: string; alpha: number } | null {
  if (points.length === 0) return null
  const isPen = tool === 'pen'
  const penOptions = PEN_TYPE_OPTIONS[penType ?? PEN_TYPES[0]]
  const inputPoints =
    isPen && penType === 'calligraphy'
      ? applyCalligraphyAngle(points)
      : isPen && penType === 'pencil'
        ? applyPencilJitter(points, size)
        : points
  const taper = !isPen || penOptions.taper
  const stroke = getStroke(inputPoints, {
    size,
    thinning: isPen ? penOptions.thinning : 0.6,
    smoothing: isPen ? penOptions.smoothing : 0.5,
    streamline: isPen ? penOptions.streamline : 0.5,
    simulatePressure: false,
    start: { taper, cap: true },
    end: { taper, cap: true },
  })
  const path = getSvgPathFromStroke(stroke)
  const alpha = tool === 'highlighter' ? highlighterAlpha : isPen ? penOptions.alpha : 1
  return { path, alpha }
}

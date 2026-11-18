import type { PageBackground, PaperColor, LineSpacing } from '../storage/db'

/** A page-space rectangle currently visible on screen. */
export interface PageViewBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** Paper fill colour + a matching line/dot colour that stays visible on it. */
export const PAPER_COLORS: Record<string, { fill: string; line: string }> = {
  white: { fill: '#f4f4f5', line: '#d4d4d8' },
  black: { fill: '#000000', line: '#2e2e33' },
  blue: { fill: '#0b1f33', line: '#1e3a57' },
  graphite: { fill: '#232326', line: '#3a3a3e' },
}

/** For a custom (non-preset) paper colour: derive a line colour that stays
 * visible on it, by lightening a dark paper or darkening a light one. */
function deriveLineColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#9ca3af'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const mix = (channel: number) => (luminance > 140 ? channel * 0.78 : channel + (255 - channel) * 0.22)
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

/** Fill + line colour for any paper colour value — a known preset name, or
 * a custom `#rrggbb` picked from the New notebook dialog's colour wheel. */
export function getPaperAppearance(paperColor: PaperColor): { fill: string; line: string } {
  const preset = PAPER_COLORS[paperColor]
  if (preset) return preset
  return { fill: paperColor, line: deriveLineColor(paperColor) }
}

const SPACING_VALUES: Record<LineSpacing, number> = {
  narrow: 20,
  medium: 32, // original, only spacing before this option existed
  wide: 44,
  xwide: 60,
}

const CORNELL_MARGIN_X = 160 // page-space x of the cue-column divider
const MARGIN_LINE_X = 70 // page-space x of the red margin line

/**
 * Paints the page background pattern into page-space coordinates (i.e. after
 * the caller has applied the pan/zoom transform). Line width is divided by
 * `scale` so grid lines stay a crisp ~1 screen pixel regardless of zoom.
 */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  background: PageBackground,
  bounds: PageViewBounds,
  scale: number,
  paperColor: PaperColor = 'white',
  lineSpacing: LineSpacing = 'medium',
  marginLine = false,
) {
  const { line: lineColor } = getPaperAppearance(paperColor)
  const SPACING = SPACING_VALUES[lineSpacing]

  if (background !== 'blank') {
    ctx.strokeStyle = lineColor
    ctx.fillStyle = lineColor
    ctx.lineWidth = 1 / scale

    const startX = Math.floor(bounds.left / SPACING) * SPACING
    const startY = Math.floor(bounds.top / SPACING) * SPACING

    if (background === 'lined' || background === 'cornell') {
      // Cornell's main (right-hand) area is ruled the same as plain
      // "Lined" — our infinite canvas has no fixed page bottom, so this is
      // the left cue-column divider only, not the full two-part layout.
      const ruleLeft = background === 'cornell' ? Math.max(bounds.left, CORNELL_MARGIN_X) : bounds.left
      ctx.beginPath()
      for (let y = startY; y <= bounds.bottom; y += SPACING) {
        ctx.moveTo(ruleLeft, y)
        ctx.lineTo(bounds.right, y)
      }
      ctx.stroke()
    } else if (background === 'grid') {
      ctx.beginPath()
      for (let y = startY; y <= bounds.bottom; y += SPACING) {
        ctx.moveTo(bounds.left, y)
        ctx.lineTo(bounds.right, y)
      }
      for (let x = startX; x <= bounds.right; x += SPACING) {
        ctx.moveTo(x, bounds.top)
        ctx.lineTo(x, bounds.bottom)
      }
      ctx.stroke()
    } else if (background === 'dotted') {
      const dotRadius = 1.5 / scale
      for (let y = startY; y <= bounds.bottom; y += SPACING) {
        for (let x = startX; x <= bounds.right; x += SPACING) {
          ctx.beginPath()
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  if (background === 'cornell' && bounds.left <= CORNELL_MARGIN_X && bounds.right >= CORNELL_MARGIN_X) {
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5 / scale
    ctx.beginPath()
    ctx.moveTo(CORNELL_MARGIN_X, bounds.top)
    ctx.lineTo(CORNELL_MARGIN_X, bounds.bottom)
    ctx.stroke()
  }

  if (marginLine && bounds.left <= MARGIN_LINE_X && bounds.right >= MARGIN_LINE_X) {
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 1.5 / scale
    ctx.beginPath()
    ctx.moveTo(MARGIN_LINE_X, bounds.top)
    ctx.lineTo(MARGIN_LINE_X, bounds.bottom)
    ctx.stroke()
  }
}

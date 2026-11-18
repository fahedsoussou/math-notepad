import type { PageBackground, PaperColor } from '../storage/db'

/** A page-space rectangle currently visible on screen. */
export interface PageViewBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** Paper fill colour + a matching line/dot colour that stays visible on it. */
export const PAPER_COLORS: Record<PaperColor, { fill: string; line: string }> = {
  white: { fill: '#f4f4f5', line: '#d4d4d8' },
  black: { fill: '#000000', line: '#2e2e33' },
  blue: { fill: '#0b1f33', line: '#1e3a57' },
  graphite: { fill: '#232326', line: '#3a3a3e' },
}

const SPACING = 32 // page-space units between lines/dots

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
) {
  if (background === 'blank') return

  const lineColor = PAPER_COLORS[paperColor].line
  ctx.strokeStyle = lineColor
  ctx.fillStyle = lineColor
  ctx.lineWidth = 1 / scale

  const startX = Math.floor(bounds.left / SPACING) * SPACING
  const startY = Math.floor(bounds.top / SPACING) * SPACING

  if (background === 'lined') {
    ctx.beginPath()
    for (let y = startY; y <= bounds.bottom; y += SPACING) {
      ctx.moveTo(bounds.left, y)
      ctx.lineTo(bounds.right, y)
    }
    ctx.stroke()
    return
  }

  if (background === 'grid') {
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
    return
  }

  if (background === 'dotted') {
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

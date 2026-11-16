import type { PageBackground } from '../storage/db'

/** A page-space rectangle currently visible on screen. */
export interface PageViewBounds {
  left: number
  top: number
  right: number
  bottom: number
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
) {
  if (background === 'blank') return

  ctx.strokeStyle = '#d4d4d8'
  ctx.fillStyle = '#d4d4d8'
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

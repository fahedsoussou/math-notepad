import { useCallback, useEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { getSvgPathFromStroke } from './strokeToPath'
import { paintBackground, type PageViewBounds } from './background'
import { db, addStroke, type PageBackground, type Stroke } from '../storage/db'

const BG_COLOR = '#f4f4f5'
const PEN_COLOR = '#1e1e2e'
const PEN_SIZE = 4

type PagePoint = [number, number, number] // x, y, pressure — all in page-space

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * The infinite ink canvas for one page. S Pen (and mouse, for laptop
 * testing) draws; touch pans (one finger) and pinch-zooms (two fingers).
 * While a pen stroke is in progress, touch is ignored outright — cheap palm
 * protection on top of whatever the OS/tablet already does.
 *
 * Two stacked canvases: `base` holds the background pattern + every
 * committed stroke, and is only repainted when the stroke list or the pan/
 * zoom transform changes. `live` holds just the stroke currently being
 * drawn, repainted on every pointer move — keeping per-frame work small
 * regardless of how many strokes the page already has.
 */
export default function InkCanvas({ pageId, background }: { pageId: string; background: PageBackground }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const transformRef = useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 })
  const [strokes, setStrokes] = useState<Stroke[]>([])

  const isDrawing = useRef(false)
  const currentPoints = useRef<PagePoint[]>([])

  // Active touch pointers, for one-finger pan / two-finger pinch-zoom.
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinch = useRef<{ distance: number; midX: number; midY: number } | null>(null)

  // Load this page's strokes once.
  useEffect(() => {
    let cancelled = false
    db.strokes
      .where({ pageId })
      .sortBy('createdAt')
      .then((loaded) => {
        if (!cancelled) setStrokes(loaded)
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  const screenToPage = useCallback((sx: number, sy: number): [number, number] => {
    const t = transformRef.current
    return [(sx - t.offsetX) / t.scale, (sy - t.offsetY) / t.scale]
  }, [])

  const applyContentTransform = useCallback((ctx: CanvasRenderingContext2D, dpr: number) => {
    const t = transformRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(t.offsetX, t.offsetY)
    ctx.scale(t.scale, t.scale)
  }, [])

  const getViewBounds = useCallback((cssWidth: number, cssHeight: number): PageViewBounds => {
    const [left, top] = screenToPage(0, 0)
    const [right, bottom] = screenToPage(cssWidth, cssHeight)
    return { left, top, right, bottom }
  }, [screenToPage])

  const paintStroke = useCallback((ctx: CanvasRenderingContext2D, points: PagePoint[], color: string, size: number) => {
    if (points.length === 0) return
    const stroke = getStroke(points, {
      size,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: false,
    })
    const path = getSvgPathFromStroke(stroke)
    ctx.fillStyle = color
    ctx.fill(new Path2D(path))
  }, [])

  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight

    // Reset to plain device-pixel space to fill the background/clear,
    // then switch to the content transform for the grid + ink.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    applyContentTransform(ctx, dpr)
    paintBackground(ctx, background, getViewBounds(cssWidth, cssHeight), transformRef.current.scale)
    for (const s of strokes) {
      paintStroke(ctx, s.points, s.color, s.size)
    }
  }, [applyContentTransform, background, getViewBounds, paintStroke, strokes])

  const redrawLive = useCallback(() => {
    const canvas = liveCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    applyContentTransform(ctx, dpr)
    paintStroke(ctx, currentPoints.current, PEN_COLOR, PEN_SIZE)
  }, [applyContentTransform, paintStroke])

  // Keep the canvases' drawing-buffer size in sync with their CSS size.
  useEffect(() => {
    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    const container = containerRef.current
    if (!base || !live || !container) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight
      for (const c of [base, live]) {
        c.width = w * dpr
        c.height = h * dpr
      }
      redrawBase()
      redrawLive()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [redrawBase, redrawLive])

  // Repaint the base layer whenever the loaded strokes or background change.
  useEffect(() => {
    redrawBase()
  }, [redrawBase])

  const toCanvasRelative = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'touch') {
        if (isDrawing.current) return // palm/finger during an active pen stroke: ignore
        const [sx, sy] = toCanvasRelative(e)
        touchPoints.current.set(e.pointerId, { x: sx, y: sy })
        lastPinch.current = null
        return
      }

      const [sx, sy] = toCanvasRelative(e)
      isDrawing.current = true
      currentPoints.current = [[...screenToPage(sx, sy), e.pressure || 0.5]]
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [screenToPage, toCanvasRelative],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'touch') {
        if (isDrawing.current || !touchPoints.current.has(e.pointerId)) return
        const [sx, sy] = toCanvasRelative(e)
        touchPoints.current.set(e.pointerId, { x: sx, y: sy })

        const active = [...touchPoints.current.values()]
        if (active.length === 1) {
          lastPinch.current = null
          // One finger: pan. We don't have last position stored separately
          // from the map, so approximate pan via the pointer's native
          // movementX/Y (CSS px, matches our offset's units).
          transformRef.current.offsetX += e.movementX
          transformRef.current.offsetY += e.movementY
          redrawBase()
          redrawLive()
        } else if (active.length >= 2) {
          const [a, b] = active
          const dx = a.x - b.x
          const dy = a.y - b.y
          const distance = Math.hypot(dx, dy)
          const midX = (a.x + b.x) / 2
          const midY = (a.y + b.y) / 2

          if (lastPinch.current) {
            const t = transformRef.current
            const scaleFactor = distance / lastPinch.current.distance
            const newScale = Math.min(6, Math.max(0.2, t.scale * scaleFactor))
            const actualFactor = newScale / t.scale
            // Zoom anchored at the OLD midpoint (keeps the page point under
            // it fixed on screen), then pan by how much the midpoint itself
            // moved — the combination tracks two-finger pinch + drag at once.
            t.offsetX = lastPinch.current.midX - (lastPinch.current.midX - t.offsetX) * actualFactor
            t.offsetY = lastPinch.current.midY - (lastPinch.current.midY - t.offsetY) * actualFactor
            t.scale = newScale
            t.offsetX += midX - lastPinch.current.midX
            t.offsetY += midY - lastPinch.current.midY
            redrawBase()
            redrawLive()
          }
          lastPinch.current = { distance, midX, midY }
        }
        return
      }

      if (!isDrawing.current) return
      const [sx, sy] = toCanvasRelative(e)
      currentPoints.current.push([...screenToPage(sx, sy), e.pressure || 0.5])
      redrawLive()
    },
    [redrawBase, redrawLive, screenToPage, toCanvasRelative],
  )

  const finishTouch = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    touchPoints.current.delete(e.pointerId)
    lastPinch.current = null
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'touch') {
        finishTouch(e)
        return
      }
      if (!isDrawing.current) return
      isDrawing.current = false

      const points = currentPoints.current
      currentPoints.current = []
      redrawLive()

      if (points.length < 2) return // a tap, not a stroke
      const stroke: Stroke = {
        id: newId(),
        pageId,
        tool: 'pen',
        color: PEN_COLOR,
        size: PEN_SIZE,
        points,
        createdAt: Date.now(),
      }
      setStrokes((prev) => [...prev, stroke])
      addStroke(stroke)
    },
    [finishTouch, pageId],
  )

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={baseCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <canvas
        ref={liveCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />
    </div>
  )
}

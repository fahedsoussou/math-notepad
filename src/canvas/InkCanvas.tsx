import { useCallback, useEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { getSvgPathFromStroke } from './strokeToPath'
import { paintBackground, type PageViewBounds } from './background'
import { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_SIZES, HIGHLIGHTER_SIZES, HIGHLIGHTER_ALPHA, ERASER_SCREEN_RADIUS } from './colors'
import { SYMBOL_PLACED_SIZE } from './symbols'
import Toolbar from './Toolbar'
import SymbolPalette from './SymbolPalette'
import { db, addStroke, deleteStroke, addSymbol, deleteSymbol, type PageBackground, type Stroke, type PlacedSymbol } from '../storage/db'

export type Tool = 'pen' | 'highlighter' | 'eraser'

const BG_COLOR = '#f4f4f5'

type PagePoint = [number, number, number] // x, y, pressure — all in page-space

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

type UndoAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; stroke: Stroke }
  | { type: 'add-symbol'; symbol: PlacedSymbol }

function newId(): string {
  return crypto.randomUUID()
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// Tests distance to each line SEGMENT, not just each stored point — a
// quick stroke (mouse, or a fast pen gesture) can have widely-spaced
// points, and the eraser would otherwise miss the ink visibly drawn
// *between* them.
function strokeHit(stroke: Stroke, px: number, py: number, radius: number): boolean {
  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0]
    return Math.hypot(x - px, y - py) <= radius
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const [x1, y1] = stroke.points[i]
    const [x2, y2] = stroke.points[i + 1]
    if (distanceToSegment(px, py, x1, y1, x2, y2) <= radius) return true
  }
  return false
}

// A "scratch-out": a short back-and-forth scribble, used to erase without
// switching to the Eraser tool. Heuristic: the path covers much more
// ground than its own bounding box (it doubles back on itself) and reverses
// direction several times — a deliberate zigzag, not an ordinary letter or
// line (which mostly moves in one direction).
function isScratchGesture(points: PagePoint[]): boolean {
  if (points.length < 6) return false

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let pathLength = 0
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    if (i > 0) pathLength += Math.hypot(x - points[i - 1][0], y - points[i - 1][1])
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY)
  if (diagonal < 1) return false

  let reversals = 0
  for (let i = 2; i < points.length; i++) {
    const d1x = points[i - 1][0] - points[i - 2][0]
    const d1y = points[i - 1][1] - points[i - 2][1]
    const d2x = points[i][0] - points[i - 1][0]
    const d2y = points[i][1] - points[i - 1][1]
    const mag1 = Math.hypot(d1x, d1y)
    const mag2 = Math.hypot(d2x, d2y)
    if (mag1 === 0 || mag2 === 0) continue
    const cosAngle = (d1x * d2x + d1y * d2y) / (mag1 * mag2)
    if (cosAngle < -0.3) reversals++
  }

  return pathLength > diagonal * 2.5 && reversals >= 3
}

// Scratch-out only erases if it's actually drawn over existing ink —
// otherwise a zigzag doodled on blank space (or fast cursive, which can
// trigger the same shape heuristic) would vanish for no visible reason.
function gestureOverlapsAnyStroke(points: PagePoint[], strokes: Stroke[], radius: number): boolean {
  for (const stroke of strokes) {
    for (const [px, py] of points) {
      if (strokeHit(stroke, px, py, radius)) return true
    }
  }
  return false
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
  const strokesRef = useRef<Stroke[]>([])
  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  const [symbols, setSymbols] = useState<PlacedSymbol[]>([])
  const [showSymbolPalette, setShowSymbolPalette] = useState(false)

  const [tool, setTool] = useState<Tool>('pen')
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0])
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1])
  const [highlighterColor, setHighlighterColor] = useState<string>(HIGHLIGHTER_COLORS[0])
  const [highlighterSize, setHighlighterSize] = useState<number>(HIGHLIGHTER_SIZES[0])
  const activeColor = tool === 'highlighter' ? highlighterColor : penColor
  const activeSize = tool === 'highlighter' ? highlighterSize : penSize
  const toolRef = useRef<Tool>(tool)
  const activeColorRef = useRef(activeColor)
  const activeSizeRef = useRef(activeSize)
  toolRef.current = tool
  activeColorRef.current = activeColor
  activeSizeRef.current = activeSize

  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])

  // Off by default — scratch-out can mistake fast cursive for a zigzag.
  // Even when on, it only fires over existing ink (see
  // gestureOverlapsAnyStroke), which rules out most false positives.
  const [scratchOutEnabled, setScratchOutEnabled] = useState(false)

  const isDrawing = useRef(false)
  const currentPoints = useRef<PagePoint[]>([])
  const erasedThisDrag = useRef<Set<string>>(new Set())

  // Active touch pointers, for one-finger pan / two-finger pinch-zoom.
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinch = useRef<{ distance: number; midX: number; midY: number } | null>(null)

  // Load this page's strokes and symbols once, and reset undo/redo for the
  // new page.
  useEffect(() => {
    let cancelled = false
    setUndoStack([])
    setRedoStack([])
    db.strokes
      .where({ pageId })
      .sortBy('createdAt')
      .then((loaded) => {
        if (!cancelled) setStrokes(loaded)
      })
    db.symbols
      .where({ pageId })
      .sortBy('createdAt')
      .then((loaded) => {
        if (!cancelled) setSymbols(loaded)
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

  const paintStroke = useCallback(
    (ctx: CanvasRenderingContext2D, points: PagePoint[], color: string, size: number, strokeTool: Tool) => {
      if (points.length === 0) return
      const stroke = getStroke(points, {
        size,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
      })
      const path = getSvgPathFromStroke(stroke)
      const previousAlpha = ctx.globalAlpha
      ctx.globalAlpha = strokeTool === 'highlighter' ? HIGHLIGHTER_ALPHA : 1
      ctx.fillStyle = color
      ctx.fill(new Path2D(path))
      ctx.globalAlpha = previousAlpha
    },
    [],
  )

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
      paintStroke(ctx, s.points, s.color, s.size, s.tool)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const sym of symbols) {
      ctx.font = `${sym.size}px sans-serif`
      ctx.fillStyle = sym.color
      ctx.fillText(sym.char, sym.x, sym.y)
    }
  }, [applyContentTransform, background, getViewBounds, paintStroke, strokes, symbols])

  const redrawLive = useCallback(() => {
    const canvas = liveCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    applyContentTransform(ctx, dpr)
    if (toolRef.current !== 'eraser') {
      paintStroke(ctx, currentPoints.current, activeColorRef.current, activeSizeRef.current, toolRef.current)
    }
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

  const placeSymbolAt = useCallback(
    (char: string, px: number, py: number) => {
      const symbol: PlacedSymbol = {
        id: newId(),
        pageId,
        char,
        x: px,
        y: py,
        size: SYMBOL_PLACED_SIZE,
        color: penColor,
        createdAt: Date.now(),
      }
      setSymbols((prev) => [...prev, symbol])
      setUndoStack((prev) => [...prev, { type: 'add-symbol', symbol }])
      setRedoStack([])
      addSymbol(symbol)
    },
    [pageId, penColor],
  )

  // Dragging a symbol from the palette onto the page: `draggingSymbol`
  // tracks the character and its current screen position (client
  // coordinates, for the floating ghost that follows the pointer); the
  // window-level listeners below run only while a drag is in progress,
  // since the pointer leaves the originating palette button immediately.
  const [draggingSymbol, setDraggingSymbol] = useState<{ char: string; clientX: number; clientY: number } | null>(
    null,
  )

  const handleSymbolDragStart = useCallback((char: string, clientX: number, clientY: number) => {
    setDraggingSymbol({ char, clientX, clientY })
    setShowSymbolPalette(false) // hide it so the canvas is visible to drop onto
  }, [])

  useEffect(() => {
    if (!draggingSymbol) return

    const onMove = (e: PointerEvent) => {
      setDraggingSymbol((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev))
    }

    const onUp = (e: PointerEvent) => {
      const canvas = liveCanvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const overCanvas =
          e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
        if (overCanvas) {
          const [px, py] = screenToPage(e.clientX - rect.left, e.clientY - rect.top)
          placeSymbolAt(draggingSymbol.char, px, py)
        }
        // Dropped outside the canvas (e.g. back over the palette, or a
        // plain tap that never left the palette button): no placement.
      }
      setDraggingSymbol(null)
      setShowSymbolPalette(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // Only re-subscribe when a drag starts/ends, not on every position
    // update within the same drag (which would tear down and rebuild the
    // listeners on every pointermove).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingSymbol?.char, placeSymbolAt, screenToPage])

  const eraseAt = useCallback(
    (px: number, py: number) => {
      const radius = ERASER_SCREEN_RADIUS / transformRef.current.scale
      const hits = strokesRef.current.filter((s) => !erasedThisDrag.current.has(s.id) && strokeHit(s, px, py, radius))
      if (hits.length === 0) return
      for (const s of hits) erasedThisDrag.current.add(s.id)
      const hitIds = new Set(hits.map((s) => s.id))
      setStrokes((prev) => prev.filter((s) => !hitIds.has(s.id)))
      setUndoStack((prev) => [...prev, ...hits.map((s): UndoAction => ({ type: 'erase', stroke: s }))])
      setRedoStack([])
      for (const s of hits) deleteStroke(s.id)
    },
    [],
  )

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
      const [px, py] = screenToPage(sx, sy)
      isDrawing.current = true
      e.currentTarget.setPointerCapture(e.pointerId)

      if (tool === 'eraser') {
        erasedThisDrag.current = new Set()
        eraseAt(px, py)
        return
      }

      currentPoints.current = [[px, py, e.pressure || 0.5]]
    },
    [eraseAt, screenToPage, tool, toCanvasRelative],
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
      const [px, py] = screenToPage(sx, sy)

      if (tool === 'eraser') {
        eraseAt(px, py)
        return
      }

      currentPoints.current.push([px, py, e.pressure || 0.5])
      redrawLive()
    },
    [eraseAt, redrawBase, redrawLive, screenToPage, tool, toCanvasRelative],
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

      if (tool === 'eraser') return

      const points = currentPoints.current
      currentPoints.current = []
      redrawLive()

      if (points.length < 2) return // a tap, not a stroke

      if (scratchOutEnabled && isScratchGesture(points)) {
        const radius = ERASER_SCREEN_RADIUS / transformRef.current.scale
        if (gestureOverlapsAnyStroke(points, strokesRef.current, radius)) {
          // Erase whatever this scribble crossed instead of drawing it —
          // same hit-testing as the Eraser tool, just along every point of
          // this gesture rather than a live pointer drag.
          erasedThisDrag.current = new Set()
          for (const [px, py] of points) eraseAt(px, py)
          return
        }
      }

      const stroke: Stroke = {
        id: newId(),
        pageId,
        // `tool` can't be 'eraser' here — the early `return` above already
        // fired for that case.
        tool: tool as 'pen' | 'highlighter',
        color: activeColor,
        size: activeSize,
        points,
        createdAt: Date.now(),
      }
      setStrokes((prev) => [...prev, stroke])
      setUndoStack((prev) => [...prev, { type: 'add', stroke }])
      setRedoStack([])
      addStroke(stroke)
    },
    [activeColor, activeSize, eraseAt, finishTouch, pageId, scratchOutEnabled, tool],
  )

  // Side effects (persisting to Dexie, touching the *other* stack) must not
  // live inside a setState updater: React may invoke an updater function
  // more than once per call (StrictMode does, deliberately, to catch exactly
  // this), which previously caused `addStroke` to run twice for the same
  // stroke id and throw "Key already exists". Updaters below only ever
  // compute the next array; the action is read from plain state first and
  // every side effect runs once, outside any updater.
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, action])
    if (action.type === 'add') {
      setStrokes((s) => s.filter((st) => st.id !== action.stroke.id))
      deleteStroke(action.stroke.id)
    } else if (action.type === 'erase') {
      setStrokes((s) => [...s, action.stroke])
      addStroke(action.stroke)
    } else {
      setSymbols((s) => s.filter((sym) => sym.id !== action.symbol.id))
      deleteSymbol(action.symbol.id)
    }
  }, [undoStack])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => [...prev, action])
    if (action.type === 'add') {
      setStrokes((s) => [...s, action.stroke])
      addStroke(action.stroke)
    } else if (action.type === 'erase') {
      setStrokes((s) => s.filter((st) => st.id !== action.stroke.id))
      deleteStroke(action.stroke.id)
    } else {
      setSymbols((s) => [...s, action.symbol])
      addSymbol(action.symbol)
    }
  }, [redoStack])

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
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={activeColor}
        onColorChange={(c) => (tool === 'highlighter' ? setHighlighterColor(c) : setPenColor(c))}
        size={activeSize}
        onSizeChange={(sz) => (tool === 'highlighter' ? setHighlighterSize(sz) : setPenSize(sz))}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        scratchOutEnabled={scratchOutEnabled}
        onToggleScratchOut={() => setScratchOutEnabled((v) => !v)}
        onToggleSymbolPalette={() => setShowSymbolPalette((v) => !v)}
      />
      {showSymbolPalette && (
        <SymbolPalette onDragStart={handleSymbolDragStart} onClose={() => setShowSymbolPalette(false)} />
      )}
      {draggingSymbol && (
        <div
          style={{
            position: 'fixed',
            left: draggingSymbol.clientX,
            top: draggingSymbol.clientY,
            transform: 'translate(-50%, -50%)',
            fontSize: 32,
            color: penColor,
            opacity: 0.85,
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {draggingSymbol.char}
        </div>
      )}
    </div>
  )
}

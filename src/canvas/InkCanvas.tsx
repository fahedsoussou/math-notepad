import { useCallback, useEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { getSvgPathFromStroke } from './strokeToPath'
import { paintBackground, PAPER_COLORS, type PageViewBounds } from './background'
import { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_SIZES, HIGHLIGHTER_SIZES, HIGHLIGHTER_ALPHA, ERASER_SCREEN_RADIUS } from './colors'
import { SYMBOL_PLACED_SIZE } from './symbols'
import { strokeInPolygon, symbolInPolygon, selectionBounds, boundsContains, type Bounds } from './lasso'
import Toolbar from './Toolbar'
import SymbolPalette from './SymbolPalette'
import {
  db,
  addStroke,
  deleteStroke,
  updateStrokePoints,
  addSymbol,
  deleteSymbol,
  updateSymbolPosition,
  type PageBackground,
  type PaperColor,
  type Stroke,
  type PlacedSymbol,
} from '../storage/db'

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso'


type PagePoint = [number, number, number] // x, y, pressure — all in page-space

interface Transform {
  offsetX: number
  offsetY: number
  scale: number
}

interface Selection {
  strokeIds: Set<string>
  symbolIds: Set<string>
}

type UndoAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; stroke: Stroke }
  | { type: 'add-symbol'; symbol: PlacedSymbol }
  | { type: 'erase-symbol'; symbol: PlacedSymbol }
  | {
      type: 'move'
      strokes: { id: string; before: Stroke['points']; after: Stroke['points'] }[]
      symbols: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[]
    }

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
export default function InkCanvas({
  pageId,
  background,
  paperColor = 'white',
}: {
  pageId: string
  background: PageBackground
  paperColor?: PaperColor
}) {
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
  const symbolsRef = useRef<PlacedSymbol[]>([])
  useEffect(() => {
    symbolsRef.current = symbols
  }, [symbols])
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

  // Lasso select: `selection` is what's currently circled (cleared when the
  // tool changes, or when a new lasso is drawn starting outside it).
  // `lassoDraftRef` holds the in-progress lasso path while dragging — a ref,
  // not state, since it's read on every pointermove without needing a
  // re-render (only the live-canvas preview needs it, drawn imperatively).
  // `movingRef` is set instead of drafting a new lasso when a drag starts
  // *inside* the current selection's bounds: it remembers each selected
  // stroke/symbol's position at drag-start so the move can be applied as a
  // simple delta and still produce a clean before/after for undo.
  const [selection, setSelection] = useState<Selection | null>(null)
  const selectionRef = useRef<Selection | null>(null)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])
  const lassoDraftRef = useRef<[number, number][]>([])
  const movingRef = useRef<{
    startX: number
    startY: number
    strokes: Map<string, Stroke['points']>
    symbols: Map<string, { x: number; y: number }>
  } | null>(null)

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
    ctx.fillStyle = PAPER_COLORS[paperColor].fill
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    applyContentTransform(ctx, dpr)
    paintBackground(ctx, background, getViewBounds(cssWidth, cssHeight), transformRef.current.scale, paperColor)
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

    if (selection) {
      const selectedStrokes = strokes.filter((s) => selection.strokeIds.has(s.id))
      const selectedSymbols = symbols.filter((s) => selection.symbolIds.has(s.id))
      const bounds = selectionBounds(selectedStrokes, selectedSymbols)
      if (bounds) {
        const pad = 10
        ctx.save()
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 1.5 / transformRef.current.scale
        ctx.setLineDash([6 / transformRef.current.scale, 4 / transformRef.current.scale])
        ctx.strokeRect(
          bounds.minX - pad,
          bounds.minY - pad,
          bounds.maxX - bounds.minX + pad * 2,
          bounds.maxY - bounds.minY + pad * 2,
        )
        ctx.restore()
      }
    }
  }, [applyContentTransform, background, getViewBounds, paintStroke, paperColor, selection, strokes, symbols])

  const redrawLive = useCallback(() => {
    const canvas = liveCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    applyContentTransform(ctx, dpr)
    if (toolRef.current === 'lasso') {
      const pts = lassoDraftRef.current
      if (pts.length > 1) {
        ctx.save()
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 1.5 / transformRef.current.scale
        ctx.setLineDash([6 / transformRef.current.scale, 4 / transformRef.current.scale])
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.stroke()
        ctx.restore()
      }
      return
    }
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

  // Finishes a lasso drag: selects whatever strokes/symbols the drawn
  // polygon caught, or clears the selection if it caught nothing.
  const finishLassoSelection = useCallback(() => {
    const polygon = lassoDraftRef.current
    lassoDraftRef.current = []
    if (polygon.length < 3) {
      setSelection(null)
      return
    }
    const strokeIds = new Set(strokesRef.current.filter((s) => strokeInPolygon(s, polygon)).map((s) => s.id))
    const symbolIds = new Set(symbolsRef.current.filter((s) => symbolInPolygon(s, polygon)).map((s) => s.id))
    setSelection(strokeIds.size > 0 || symbolIds.size > 0 ? { strokeIds, symbolIds } : null)
  }, [])

  // If a drag starts inside the current selection's bounds, it moves the
  // selection instead of starting a new lasso. Returns whether it did.
  const tryStartMove = useCallback((px: number, py: number): boolean => {
    const sel = selectionRef.current
    if (!sel) return false
    const selectedStrokes = strokesRef.current.filter((s) => sel.strokeIds.has(s.id))
    const selectedSymbols = symbolsRef.current.filter((s) => sel.symbolIds.has(s.id))
    const bounds: Bounds | null = selectionBounds(selectedStrokes, selectedSymbols)
    if (!bounds || !boundsContains(bounds, px, py)) return false

    movingRef.current = {
      startX: px,
      startY: py,
      strokes: new Map(selectedStrokes.map((s) => [s.id, s.points])),
      symbols: new Map(selectedSymbols.map((s) => [s.id, { x: s.x, y: s.y }])),
    }
    return true
  }, [])

  const applyMoveDelta = useCallback((px: number, py: number) => {
    const moving = movingRef.current
    if (!moving) return
    const dx = px - moving.startX
    const dy = py - moving.startY

    if (moving.strokes.size > 0) {
      setStrokes((prev) =>
        prev.map((s) => {
          const original = moving.strokes.get(s.id)
          return original ? { ...s, points: original.map(([x, y, p]): [number, number, number] => [x + dx, y + dy, p]) } : s
        }),
      )
    }
    if (moving.symbols.size > 0) {
      setSymbols((prev) =>
        prev.map((sym) => {
          const original = moving.symbols.get(sym.id)
          return original ? { ...sym, x: original.x + dx, y: original.y + dy } : sym
        }),
      )
    }
  }, [])

  const commitMove = useCallback(
    (px: number, py: number) => {
      const moving = movingRef.current
      movingRef.current = null
      if (!moving) return
      const dx = px - moving.startX
      const dy = py - moving.startY
      if (dx === 0 && dy === 0) return // tapped inside the selection without dragging: nothing to do

      const strokeMoves: { id: string; before: Stroke['points']; after: Stroke['points'] }[] = []
      for (const [id, before] of moving.strokes) {
        const after: Stroke['points'] = before.map(([x, y, p]) => [x + dx, y + dy, p])
        strokeMoves.push({ id, before, after })
        updateStrokePoints(id, after)
      }
      const symbolMoves: { id: string; before: { x: number; y: number }; after: { x: number; y: number } }[] = []
      for (const [id, before] of moving.symbols) {
        const after = { x: before.x + dx, y: before.y + dy }
        symbolMoves.push({ id, before, after })
        updateSymbolPosition(id, after.x, after.y)
      }
      setUndoStack((prev) => [...prev, { type: 'move', strokes: strokeMoves, symbols: symbolMoves }])
      setRedoStack([])
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
      // Best-effort: capture just keeps delivering events to this element
      // if the pointer strays outside it mid-gesture. If it throws (some
      // browsers refuse it for a pointer they don't consider "active" in
      // certain states), drawing/lasso/erase still work via normal
      // bubbling as long as the pointer stays over the canvas — so a
      // failure here must never abort the rest of this handler.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignored — see above
      }

      if (tool === 'eraser') {
        erasedThisDrag.current = new Set()
        eraseAt(px, py)
        return
      }

      if (tool === 'lasso') {
        if (tryStartMove(px, py)) return
        setSelection(null)
        lassoDraftRef.current = [[px, py]]
        return
      }

      currentPoints.current = [[px, py, e.pressure || 0.5]]
    },
    [eraseAt, screenToPage, tool, toCanvasRelative, tryStartMove],
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
            const newScale = Math.min(10, Math.max(0.2, t.scale * scaleFactor))
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

      if (tool === 'lasso') {
        if (movingRef.current) {
          applyMoveDelta(px, py)
        } else {
          lassoDraftRef.current.push([px, py])
          redrawLive()
        }
        return
      }

      currentPoints.current.push([px, py, e.pressure || 0.5])
      redrawLive()
    },
    [applyMoveDelta, eraseAt, redrawBase, redrawLive, screenToPage, tool, toCanvasRelative],
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

      if (tool === 'lasso') {
        if (movingRef.current) {
          const [sx, sy] = toCanvasRelative(e)
          const [px, py] = screenToPage(sx, sy)
          commitMove(px, py)
        } else {
          finishLassoSelection()
          redrawLive()
        }
        return
      }

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
        // `tool` can't be 'eraser' or 'lasso' here — the early returns above
        // already fired for those cases.
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
    [
      activeColor,
      activeSize,
      commitMove,
      eraseAt,
      finishLassoSelection,
      finishTouch,
      pageId,
      redrawLive,
      screenToPage,
      scratchOutEnabled,
      tool,
      toCanvasRelative,
    ],
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
    } else if (action.type === 'add-symbol') {
      setSymbols((s) => s.filter((sym) => sym.id !== action.symbol.id))
      deleteSymbol(action.symbol.id)
    } else if (action.type === 'erase-symbol') {
      setSymbols((s) => [...s, action.symbol])
      addSymbol(action.symbol)
    } else {
      const beforeStrokes = new Map(action.strokes.map((m) => [m.id, m.before]))
      const beforeSymbols = new Map(action.symbols.map((m) => [m.id, m.before]))
      setStrokes((s) => s.map((st) => (beforeStrokes.has(st.id) ? { ...st, points: beforeStrokes.get(st.id)! } : st)))
      setSymbols((s) => s.map((sym) => (beforeSymbols.has(sym.id) ? { ...sym, ...beforeSymbols.get(sym.id)! } : sym)))
      for (const m of action.strokes) updateStrokePoints(m.id, m.before)
      for (const m of action.symbols) updateSymbolPosition(m.id, m.before.x, m.before.y)
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
    } else if (action.type === 'add-symbol') {
      setSymbols((s) => [...s, action.symbol])
      addSymbol(action.symbol)
    } else if (action.type === 'erase-symbol') {
      setSymbols((s) => s.filter((sym) => sym.id !== action.symbol.id))
      deleteSymbol(action.symbol.id)
    } else {
      const afterStrokes = new Map(action.strokes.map((m) => [m.id, m.after]))
      const afterSymbols = new Map(action.symbols.map((m) => [m.id, m.after]))
      setStrokes((s) => s.map((st) => (afterStrokes.has(st.id) ? { ...st, points: afterStrokes.get(st.id)! } : st)))
      setSymbols((s) => s.map((sym) => (afterSymbols.has(sym.id) ? { ...sym, ...afterSymbols.get(sym.id)! } : sym)))
      for (const m of action.strokes) updateStrokePoints(m.id, m.after)
      for (const m of action.symbols) updateSymbolPosition(m.id, m.after.x, m.after.y)
    }
  }, [redoStack])

  const handleToolChange = useCallback((next: Tool) => {
    setTool(next)
    if (next !== 'lasso') setSelection(null)
  }, [])

  const handleDeleteSelection = useCallback(() => {
    const sel = selection
    if (!sel) return
    const deletedStrokes = strokesRef.current.filter((s) => sel.strokeIds.has(s.id))
    const deletedSymbols = symbolsRef.current.filter((s) => sel.symbolIds.has(s.id))
    setStrokes((prev) => prev.filter((s) => !sel.strokeIds.has(s.id)))
    setSymbols((prev) => prev.filter((s) => !sel.symbolIds.has(s.id)))
    setUndoStack((prev) => [
      ...prev,
      ...deletedStrokes.map((stroke): UndoAction => ({ type: 'erase', stroke })),
      ...deletedSymbols.map((symbol): UndoAction => ({ type: 'erase-symbol', symbol })),
    ])
    setRedoStack([])
    for (const s of deletedStrokes) deleteStroke(s.id)
    for (const s of deletedSymbols) deleteSymbol(s.id)
    setSelection(null)
  }, [selection])

  // Nudges the copy so it's visibly separate from the original, then
  // selects the copy — lets you immediately drag it into place.
  const DUPLICATE_OFFSET = 24

  const handleDuplicateSelection = useCallback(() => {
    const sel = selection
    if (!sel) return
    const now = Date.now()

    const newStrokes: Stroke[] = strokesRef.current
      .filter((s) => sel.strokeIds.has(s.id))
      .map((s) => ({
        ...s,
        id: newId(),
        points: s.points.map(([x, y, p]): [number, number, number] => [x + DUPLICATE_OFFSET, y + DUPLICATE_OFFSET, p]),
        createdAt: now,
      }))
    const newSymbols: PlacedSymbol[] = symbolsRef.current
      .filter((s) => sel.symbolIds.has(s.id))
      .map((s) => ({ ...s, id: newId(), x: s.x + DUPLICATE_OFFSET, y: s.y + DUPLICATE_OFFSET, createdAt: now }))

    if (newStrokes.length === 0 && newSymbols.length === 0) return

    setStrokes((prev) => [...prev, ...newStrokes])
    setSymbols((prev) => [...prev, ...newSymbols])
    setUndoStack((prev) => [
      ...prev,
      ...newStrokes.map((stroke): UndoAction => ({ type: 'add', stroke })),
      ...newSymbols.map((symbol): UndoAction => ({ type: 'add-symbol', symbol })),
    ])
    setRedoStack([])
    for (const s of newStrokes) addStroke(s)
    for (const s of newSymbols) addSymbol(s)
    setSelection({ strokeIds: new Set(newStrokes.map((s) => s.id)), symbolIds: new Set(newSymbols.map((s) => s.id)) })
  }, [selection])

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
        onToolChange={handleToolChange}
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
        hasSelection={selection !== null}
        onDuplicateSelection={handleDuplicateSelection}
        onDeleteSelection={handleDeleteSelection}
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

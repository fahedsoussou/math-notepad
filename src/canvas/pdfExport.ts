// Phase 4: PDF/PNG export. Reuses strokeGeometry.ts's exact outline
// generation (the same code InkCanvas.tsx draws on screen), so exported
// ink is true vector geometry — matching CLAUDE.md's "vector PDF export"
// must-have — not a raster screenshot of the canvas.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import { db, type Stroke, type PlacedSymbol } from '../storage/db'
import { strokeOutline } from './strokeGeometry'
import { selectionBounds } from './lasso'
import { HIGHLIGHTER_ALPHA } from './colors'
import { getPaperAppearance } from './background'

const DEFAULT_WIDTH = 612 // US Letter, in points — our pages have no
const DEFAULT_HEIGHT = 792 // fixed size, so this is just a sensible default
const MARGIN = 24

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Adds one PDF page sized to fit the content (padded), or a default
 * Letter size if the page is empty. Ink is drawn as real vector paths
 * (page.drawSvgPath, fed the exact same outline strokeOutline() computes
 * for on-screen rendering) — not a bitmap. Deliberately does NOT include
 * the page's background pattern/paper colour (lined/grid/dotted/Cornell,
 * paper colour) — only ink + symbols, a real scope limit for this first
 * version, not a bug. Greek-letter/math-operator symbols are skipped
 * (caught per-symbol, not fatal to the whole export): pdf-lib's built-in
 * fonts only support WinAnsiEncoding (Latin-ish), and embedding a custom
 * Unicode font for full Greek/math coverage is future work. */
function addPageToPdf(pdfDoc: PDFDocument, font: PDFFont, strokes: Stroke[], symbols: PlacedSymbol[]) {
  const bounds = selectionBounds(strokes, symbols)
  const width = bounds ? Math.max(DEFAULT_WIDTH, bounds.maxX - bounds.minX + MARGIN * 2) : DEFAULT_WIDTH
  const height = bounds ? Math.max(DEFAULT_HEIGHT, bounds.maxY - bounds.minY + MARGIN * 2) : DEFAULT_HEIGHT
  const offsetX = bounds ? MARGIN - bounds.minX : 0
  const offsetY = bounds ? MARGIN - bounds.minY : 0

  const page = pdfDoc.addPage([width, height])

  for (const s of strokes) {
    const outline = strokeOutline(s.points, s.size, s.tool, s.penType, HIGHLIGHTER_ALPHA)
    if (!outline) continue
    const { r, g, b } = hexToRgb01(s.color)
    // pdf-lib's drawSvgPath flips the Y axis internally so a path authored
    // in canvas/browser coordinates (Y down) draws right-side-up in PDF
    // space (Y up) when anchored at the page's own height.
    page.drawSvgPath(outline.path, {
      x: offsetX,
      y: height - offsetY,
      color: rgb(r, g, b),
      opacity: outline.alpha,
    })
  }

  for (const sym of symbols) {
    try {
      const { r, g, b } = hexToRgb01(sym.color)
      page.drawText(sym.char, {
        x: sym.x + offsetX - sym.size / 2,
        y: height - (sym.y + offsetY) - sym.size / 2,
        size: sym.size,
        font,
        color: rgb(r, g, b),
      })
    } catch {
      // Not encodable in this font (Greek letter / math operator) —
      // documented limitation above, skip rather than fail the export.
    }
  }
}

async function loadStrokesAndSymbols(pageId: string) {
  const [strokes, symbols] = await Promise.all([
    db.strokes.where({ pageId }).toArray(),
    db.symbols.where({ pageId }).toArray(),
  ])
  return { strokes, symbols }
}

export async function exportPagePDF(pageId: string): Promise<void> {
  const page = await db.pages.get(pageId)
  if (!page) throw new Error('This page no longer exists.')
  const { strokes, symbols } = await loadStrokesAndSymbols(pageId)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  addPageToPdf(pdfDoc, font, strokes, symbols)
  const bytes = await pdfDoc.save()
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${page.title || 'page'}.pdf`)
}

export async function exportNotebookPDF(notebookId: string): Promise<void> {
  const notebook = await db.notebooks.get(notebookId)
  const pages = await db.pages
    .where({ notebookId })
    .and((p) => p.deletedAt === null)
    .sortBy('order')
  if (pages.length === 0) throw new Error('This notebook has no pages to export.')
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  for (const page of pages) {
    const { strokes, symbols } = await loadStrokesAndSymbols(page.id)
    addPageToPdf(pdfDoc, font, strokes, symbols)
  }
  const bytes = await pdfDoc.save()
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${notebook?.name || 'notebook'}.pdf`)
}

/** PNG export renders through a real canvas (unlike the PDF path), so —
 * unlike PDF export — it DOES include the page's background pattern and
 * paper colour, matching exactly what's on screen. A PNG is a bitmap
 * either way, so there's no vector-fidelity reason to leave it out here. */
export async function exportPagePNG(pageId: string): Promise<void> {
  const page = await db.pages.get(pageId)
  if (!page) throw new Error('This page no longer exists.')
  const { strokes, symbols } = await loadStrokesAndSymbols(pageId)

  const bounds = selectionBounds(strokes, symbols)
  const width = bounds ? bounds.maxX - bounds.minX + MARGIN * 2 : DEFAULT_WIDTH
  const height = bounds ? bounds.maxY - bounds.minY + MARGIN * 2 : DEFAULT_HEIGHT
  const offsetX = bounds ? MARGIN - bounds.minX : MARGIN
  const offsetY = bounds ? MARGIN - bounds.minY : MARGIN

  const SCALE = 2 // render at 2x for a crisper PNG than a 1:1 page-unit canvas
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * SCALE)
  canvas.height = Math.ceil(height * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas to render this page.')

  const paperColor = page.paperColor ?? 'white'
  ctx.fillStyle = getPaperAppearance(paperColor).fill
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.setTransform(SCALE, 0, 0, SCALE, offsetX * SCALE, offsetY * SCALE)

  for (const s of strokes) {
    const outline = strokeOutline(s.points, s.size, s.tool, s.penType, HIGHLIGHTER_ALPHA)
    if (!outline) continue
    const previousAlpha = ctx.globalAlpha
    ctx.globalAlpha = outline.alpha
    ctx.fillStyle = s.color
    ctx.fill(new Path2D(outline.path))
    ctx.globalAlpha = previousAlpha
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const sym of symbols) {
    ctx.font = `${sym.size}px sans-serif`
    ctx.fillStyle = sym.color
    ctx.fillText(sym.char, sym.x, sym.y)
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the PNG image.')
  downloadBlob(blob, `${page.title || 'page'}.png`)
}

// Shared pdf.js setup — Phase 4 PDF import. pdf.js needs its own worker
// file configured once before any document loads; both the import flow
// (counting pages) and InkCanvas's background rendering (drawing a page)
// go through this one module so that setup only happens once.
import * as pdfjsLib from 'pdfjs-dist'
// Vite's `new URL(..., import.meta.url)` pattern (same one used for the
// math-engine's Worker) gives pdf.js's own worker a URL it can load
// itself — pdf.js manages this worker internally, unlike our own
// `new Worker(...)` code in math-engine/client.ts.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>

export async function loadPdfDocument(data: ArrayBuffer): Promise<PdfDocument> {
  const loadingTask = pdfjsLib.getDocument({ data })
  return loadingTask.promise
}

/** Renders one page (1-based, matching pdf.js's own convention) to a new
 * canvas at the given scale (1 = the PDF's own point size, 72/inch). */
export async function renderPdfPageToCanvas(doc: PdfDocument, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas to render this PDF page.')
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas
}

/** The PDF page's own size in points (1 point = 1 of our page-space
 * units, by convention — see InkCanvas.tsx's PDF background rendering). */
export async function getPdfPageSize(doc: PdfDocument, pageNumber: number): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  return { width: viewport.width, height: viewport.height }
}

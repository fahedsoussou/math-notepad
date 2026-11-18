// Phase 4: PDF import. Turns a picked PDF file into a new notebook with
// one page per PDF page (CLAUDE.md's must-have: "Each page of the PDF
// becomes a page of the notebook"), storing the original bytes so the
// pages can be re-rendered every time the notebook is reopened — see
// PdfSource in storage/db.ts for why that's its own table.
import { db, createFolder, type Page } from '../storage/db'
import { loadPdfDocument } from './pdfjs'

function newId(): string {
  return crypto.randomUUID()
}

/** Imports `file` as a new notebook (named after the file) in `folderId`
 * — or a newly-created/reused "Unfiled" folder if `folderId` is null,
 * same convention as HomeScreen's "+ New notebook" with no folder
 * context. Returns the new notebook's id. */
export async function importPdf(file: File, folderId: string | null): Promise<{ notebookId: string; pageCount: number }> {
  const bytes = await file.arrayBuffer()
  const doc = await loadPdfDocument(bytes.slice(0))
  const pageCount = doc.numPages
  if (pageCount === 0) throw new Error('This PDF has no pages.')

  let targetFolderId = folderId
  if (!targetFolderId) {
    const folders = await db.folders.filter((f) => f.deletedAt === null).sortBy('name')
    targetFolderId = folders[0]?.id ?? (await createFolder('Unfiled', '#71717a')).id
  }

  const now = Date.now()
  const notebookId = newId()
  const title = file.name.replace(/\.pdf$/i, '') || 'Imported PDF'

  const pages: Page[] = Array.from({ length: pageCount }, (_, i) => ({
    id: newId(),
    notebookId,
    order: i,
    title: pageCount > 1 ? `Page ${i + 1}` : title,
    background: 'blank',
    pdfPageIndex: i,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }))

  await db.transaction('rw', db.notebooks, db.pages, db.pdfSources, async () => {
    await db.notebooks.add({
      id: notebookId,
      folderId: targetFolderId!,
      name: title,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
      deletedAt: null,
    })
    await db.pages.bulkAdd(pages)
    await db.pdfSources.add({
      notebookId,
      data: new Blob([bytes], { type: 'application/pdf' }),
      pageCount,
      createdAt: now,
    })
  })

  return { notebookId, pageCount }
}

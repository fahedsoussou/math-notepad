import Dexie, { type EntityTable } from 'dexie'

/**
 * Library data model: folders (per subject) > notebooks > pages.
 *
 * Deletion is soft: `deletedAt` is set instead of removing the row, so
 * folders/notebooks/pages can live in a Trash view and be restored. Only
 * "Empty trash" permanently removes rows. This matters for CLAUDE.md Rule 2
 * (app updates / normal use must never silently delete user notes).
 */

export interface Folder {
  id: string
  name: string
  color: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Notebook {
  id: string
  folderId: string
  name: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
  deletedAt: number | null
}

export type PageBackground = 'blank' | 'lined' | 'grid' | 'dotted'

/** Paper colour, independent of the line/dot pattern above. */
export type PaperColor = 'white' | 'black' | 'blue' | 'graphite'

export interface Page {
  id: string
  notebookId: string
  /** Position within the notebook; pages are ordered by this, not createdAt. */
  order: number
  title: string
  /** Added in schema v2; absent on pages written before that, default to 'blank' when reading. */
  background?: PageBackground
  /** Added later; absent on older pages, default to 'white' when reading. */
  paperColor?: PaperColor
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/** A single pen/highlighter stroke, in page-space coordinates (independent of pan/zoom). */
export interface Stroke {
  id: string
  pageId: string
  tool: 'pen' | 'highlighter'
  color: string
  size: number
  /** [x, y, pressure] per point, in page-space coordinates. */
  points: [number, number, number][]
  createdAt: number
}

/**
 * A Greek letter or math operator placed from the symbol palette, typed
 * text rather than ink. `x, y` is the symbol's page-space anchor point
 * (independent of pan/zoom, same as a Stroke's points).
 */
export interface PlacedSymbol {
  id: string
  pageId: string
  char: string
  x: number
  y: number
  size: number
  color: string
  createdAt: number
}

/**
 * App-wide settings — a single row, keyed by the fixed id `SETTINGS_ID`.
 * Stored only on this device, in IndexedDB like everything else here.
 * `geminiApiKey` in particular must never leave this table: never logged,
 * never included in a future library backup export, never sent anywhere
 * except directly to Google's API when the user triggers an AI request
 * (Phase 1B) — see CLAUDE.md Rule 1.
 */
export interface AppSettings {
  id: typeof SETTINGS_ID
  geminiApiKey: string | null
  suggestMode: boolean
  darkMode: boolean
}

export const SETTINGS_ID = 'app' as const

export const DEFAULT_SETTINGS: AppSettings = {
  id: SETTINGS_ID,
  geminiApiKey: null,
  suggestMode: true,
  darkMode: false,
}

class MathNotepadDB extends Dexie {
  folders!: EntityTable<Folder, 'id'>
  notebooks!: EntityTable<Notebook, 'id'>
  pages!: EntityTable<Page, 'id'>
  strokes!: EntityTable<Stroke, 'id'>
  symbols!: EntityTable<PlacedSymbol, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('math-notepad')
    this.version(1).stores({
      folders: 'id, deletedAt',
      notebooks: 'id, folderId, deletedAt, lastOpenedAt',
      pages: 'id, notebookId, deletedAt, order',
    })
    // v2 adds ink storage. Additive only (new table, new optional Page
    // field) — existing folders/notebooks/pages rows are untouched, so no
    // migration function is needed to preserve them (Rule 2).
    this.version(2).stores({
      strokes: 'id, pageId, createdAt',
    })
    // v3 adds placed symbols (Greek letters/operators from the palette).
    // Additive only, same as v2 — no migration needed.
    this.version(3).stores({
      symbols: 'id, pageId, createdAt',
    })
    // v4 adds the single app-settings row. Additive only — no migration
    // needed; the row is created on first read if missing (see
    // getSettings below), not seeded here.
    this.version(4).stores({
      settings: 'id',
    })
  }
}

export const db = new MathNotepadDB()

function newId(): string {
  return crypto.randomUUID()
}

// ---- Folders ----------------------------------------------------------

export async function createFolder(name: string, color: string): Promise<Folder> {
  const now = Date.now()
  const folder: Folder = { id: newId(), name, color, createdAt: now, updatedAt: now, deletedAt: null }
  await db.folders.add(folder)
  return folder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await db.folders.update(id, { name, updatedAt: Date.now() })
}

export async function setFolderColor(id: string, color: string): Promise<void> {
  await db.folders.update(id, { color, updatedAt: Date.now() })
}

export async function trashFolder(id: string): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.folders, db.notebooks, async () => {
    await db.folders.update(id, { deletedAt: now })
    const notebooks = await db.notebooks.where({ folderId: id }).toArray()
    await Promise.all(notebooks.map((n) => db.notebooks.update(n.id, { deletedAt: now })))
  })
}

export async function restoreFolder(id: string): Promise<void> {
  await db.folders.update(id, { deletedAt: null })
}

// ---- Notebooks ----------------------------------------------------------

export async function createNotebook(folderId: string, name: string): Promise<Notebook> {
  const now = Date.now()
  const notebook: Notebook = {
    id: newId(),
    folderId,
    name,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    deletedAt: null,
  }
  await db.notebooks.add(notebook)
  return notebook
}

export async function renameNotebook(id: string, name: string): Promise<void> {
  await db.notebooks.update(id, { name, updatedAt: Date.now() })
}

export async function moveNotebook(id: string, folderId: string): Promise<void> {
  await db.notebooks.update(id, { folderId, updatedAt: Date.now() })
}

export async function touchNotebookOpened(id: string): Promise<void> {
  await db.notebooks.update(id, { lastOpenedAt: Date.now() })
}

export async function trashNotebook(id: string): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.notebooks.update(id, { deletedAt: now })
    const pages = await db.pages.where({ notebookId: id }).toArray()
    await Promise.all(pages.map((p) => db.pages.update(p.id, { deletedAt: now })))
  })
}

export async function restoreNotebook(id: string): Promise<void> {
  await db.notebooks.update(id, { deletedAt: null })
}

export async function duplicateNotebook(id: string): Promise<Notebook | null> {
  const source = await db.notebooks.get(id)
  if (!source) return null
  const now = Date.now()
  const copy: Notebook = {
    ...source,
    id: newId(),
    name: `${source.name} copy`,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    deletedAt: null,
  }
  const sourcePages = await db.pages.where({ notebookId: id }).and((p) => p.deletedAt === null).toArray()
  const copiedPages: Page[] = sourcePages.map((p) => ({
    ...p,
    id: newId(),
    notebookId: copy.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }))
  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.notebooks.add(copy)
    if (copiedPages.length > 0) await db.pages.bulkAdd(copiedPages)
  })
  return copy
}

// ---- Pages ----------------------------------------------------------

export async function createPage(notebookId: string, title = 'Untitled page'): Promise<Page> {
  const now = Date.now()
  const existing = await db.pages.where({ notebookId }).toArray()
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.order), -1)
  const page: Page = {
    id: newId(),
    notebookId,
    order: maxOrder + 1,
    title,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.pages.add(page)
  return page
}

export async function renamePage(id: string, title: string): Promise<void> {
  await db.pages.update(id, { title, updatedAt: Date.now() })
}

export async function trashPage(id: string): Promise<void> {
  await db.pages.update(id, { deletedAt: Date.now() })
}

export async function restorePage(id: string): Promise<void> {
  await db.pages.update(id, { deletedAt: null })
}

export async function duplicatePage(id: string): Promise<Page | null> {
  const source = await db.pages.get(id)
  if (!source) return null
  const now = Date.now()
  const copy: Page = { ...source, id: newId(), title: `${source.title} copy`, createdAt: now, updatedAt: now, deletedAt: null }
  const sourceStrokes = await db.strokes.where({ pageId: id }).toArray()
  const copiedStrokes: Stroke[] = sourceStrokes.map((s) => ({ ...s, id: newId(), pageId: copy.id, createdAt: now }))
  const sourceSymbols = await db.symbols.where({ pageId: id }).toArray()
  const copiedSymbols: PlacedSymbol[] = sourceSymbols.map((s) => ({ ...s, id: newId(), pageId: copy.id, createdAt: now }))
  await db.transaction('rw', db.pages, db.strokes, db.symbols, async () => {
    await db.pages.add(copy)
    if (copiedStrokes.length > 0) await db.strokes.bulkAdd(copiedStrokes)
    if (copiedSymbols.length > 0) await db.symbols.bulkAdd(copiedSymbols)
  })
  return copy
}

export async function setPageBackground(id: string, background: PageBackground): Promise<void> {
  await db.pages.update(id, { background, updatedAt: Date.now() })
}

export async function setPaperColor(id: string, paperColor: PaperColor): Promise<void> {
  await db.pages.update(id, { paperColor, updatedAt: Date.now() })
}

// ---- Strokes ----------------------------------------------------------

export async function addStroke(stroke: Stroke): Promise<void> {
  await db.strokes.add(stroke)
}

export async function deleteStroke(id: string): Promise<void> {
  await db.strokes.delete(id)
}

export async function deleteStrokes(ids: string[]): Promise<void> {
  await db.strokes.bulkDelete(ids)
}

export async function updateStrokePoints(id: string, points: Stroke['points']): Promise<void> {
  await db.strokes.update(id, { points })
}

// ---- Symbols ----------------------------------------------------------

export async function addSymbol(symbol: PlacedSymbol): Promise<void> {
  await db.symbols.add(symbol)
}

export async function deleteSymbol(id: string): Promise<void> {
  await db.symbols.delete(id)
}

export async function updateSymbolPosition(id: string, x: number, y: number): Promise<void> {
  await db.symbols.update(id, { x, y })
}

// ---- Settings ----------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(SETTINGS_ID)
  return existing ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch })
}

// ---- Trash (cross-type) ----------------------------------------------------------

export async function emptyTrash(): Promise<void> {
  await db.transaction('rw', db.folders, db.notebooks, db.pages, db.strokes, db.symbols, async () => {
    const trashedPages = await db.pages.where('deletedAt').above(0).toArray()
    await db.folders.where('deletedAt').above(0).delete()
    await db.notebooks.where('deletedAt').above(0).delete()
    await db.pages.where('deletedAt').above(0).delete()
    for (const page of trashedPages) {
      await db.strokes.where({ pageId: page.id }).delete()
      await db.symbols.where({ pageId: page.id }).delete()
    }
  })
}

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

export interface Page {
  id: string
  notebookId: string
  /** Position within the notebook; pages are ordered by this, not createdAt. */
  order: number
  title: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

class MathNotepadDB extends Dexie {
  folders!: EntityTable<Folder, 'id'>
  notebooks!: EntityTable<Notebook, 'id'>
  pages!: EntityTable<Page, 'id'>

  constructor() {
    super('math-notepad')
    this.version(1).stores({
      folders: 'id, deletedAt',
      notebooks: 'id, folderId, deletedAt, lastOpenedAt',
      pages: 'id, notebookId, deletedAt, order',
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
  await db.pages.add(copy)
  return copy
}

// ---- Trash (cross-type) ----------------------------------------------------------

export async function emptyTrash(): Promise<void> {
  await db.transaction('rw', db.folders, db.notebooks, db.pages, async () => {
    await db.folders.where('deletedAt').above(0).delete()
    await db.notebooks.where('deletedAt').above(0).delete()
    await db.pages.where('deletedAt').above(0).delete()
  })
}

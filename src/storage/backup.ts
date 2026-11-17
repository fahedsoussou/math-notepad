import { db, type Folder, type Notebook, type Page, type Stroke, type PlacedSymbol } from './db'

/**
 * Full-library backup: every folder/notebook/page/stroke/symbol, including
 * trashed ones (so restoring a backup doesn't silently lose anything the
 * user hadn't emptied from Trash yet). Settings are intentionally NOT
 * included — `geminiApiKey` must never end up in a file the user might
 * email or share (CLAUDE.md Rule 1); Suggest/Quiet and dark mode are tiny
 * device preferences, not "library" data, and aren't worth the risk of
 * bundling them in next to the key.
 */
export interface BackupData {
  version: 1
  exportedAt: number
  folders: Folder[]
  notebooks: Notebook[]
  pages: Page[]
  strokes: Stroke[]
  symbols: PlacedSymbol[]
}

export async function buildBackup(): Promise<BackupData> {
  const [folders, notebooks, pages, strokes, symbols] = await Promise.all([
    db.folders.toArray(),
    db.notebooks.toArray(),
    db.pages.toArray(),
    db.strokes.toArray(),
    db.symbols.toArray(),
  ])
  return { version: 1, exportedAt: Date.now(), folders, notebooks, pages, strokes, symbols }
}

/** Triggers a browser download of the current library as a JSON file. */
export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `math-notepad-backup-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    Array.isArray(v.folders) &&
    Array.isArray(v.notebooks) &&
    Array.isArray(v.pages) &&
    Array.isArray(v.strokes) &&
    Array.isArray(v.symbols)
  )
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON — it may be corrupted or not a Math Notepad backup.')
  }
  if (!isBackupData(parsed)) {
    throw new Error('That file doesn’t look like a Math Notepad backup.')
  }
  return parsed
}

/**
 * Merges a backup into the current library: every row is written by id
 * (`bulkPut`), so importing the same backup twice is harmless (it just
 * overwrites with the same data), and it never removes anything already
 * in the library that isn't part of the backup — restoring never deletes
 * notes made since the backup was taken (Rule 2).
 */
export async function importBackup(backup: BackupData): Promise<void> {
  await db.transaction('rw', db.folders, db.notebooks, db.pages, db.strokes, db.symbols, async () => {
    if (backup.folders.length > 0) await db.folders.bulkPut(backup.folders)
    if (backup.notebooks.length > 0) await db.notebooks.bulkPut(backup.notebooks)
    if (backup.pages.length > 0) await db.pages.bulkPut(backup.pages)
    if (backup.strokes.length > 0) await db.strokes.bulkPut(backup.strokes)
    if (backup.symbols.length > 0) await db.symbols.bulkPut(backup.symbols)
  })
}

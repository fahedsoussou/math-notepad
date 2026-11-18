import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createFolder, createNotebook, type NotebookDefaults } from '../storage/db'
import * as s from './styles'
import NewFolderDialog from './NewFolderDialog'
import NewNotebookDialog from './NewNotebookDialog'
import { FolderIcon, PageIcon, SettingsIcon, TrashIcon } from './icons'

interface Props {
  onOpenFolder: (folderId: string) => void
  onOpenNotebook: (notebookId: string, folderId: string | null) => void
  onOpenTrash: () => void
  onOpenSettings: () => void
}

export default function HomeScreen({ onOpenFolder, onOpenNotebook, onOpenTrash, onOpenSettings }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showNewNotebook, setShowNewNotebook] = useState(false)

  const folders = useLiveQuery(() => db.folders.filter((f) => f.deletedAt === null).sortBy('name'), [])
  const recentNotebooks = useLiveQuery(
    () =>
      db.notebooks
        .filter((n) => n.deletedAt === null && n.lastOpenedAt !== null)
        .toArray()
        .then((list) => list.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 8)),
    [],
  )
  const notebookCounts = useLiveQuery(async () => {
    const notebooks = await db.notebooks.filter((n) => n.deletedAt === null).toArray()
    const counts: Record<string, number> = {}
    for (const n of notebooks) counts[n.folderId] = (counts[n.folderId] ?? 0) + 1
    return counts
  }, [])
  const trashCount = useLiveQuery(async () => {
    const [f, n, p] = await Promise.all([
      db.folders.filter((x) => x.deletedAt !== null).count(),
      db.notebooks.filter((x) => x.deletedAt !== null).count(),
      db.pages.filter((x) => x.deletedAt !== null).count(),
    ])
    return f + n + p
  }, [])

  const handleCreateFolder = async (name: string, color: string) => {
    setShowNewFolder(false)
    await createFolder(name, color)
  }

  const handleCreateNotebook = async (name: string, defaults: NotebookDefaults) => {
    setShowNewNotebook(false)
    // Notebooks created from Home with no folder context go in a virtual
    // "Unfiled" bucket: we still need *a* folder id, so the first folder is
    // used, or one is created automatically if none exist yet.
    let folder = folders?.[0]
    if (!folder) {
      folder = await createFolder('Unfiled', '#71717a')
    }
    const notebook = await createNotebook(folder.id, name, defaults)
    onOpenNotebook(notebook.id, folder.id)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Your Notebooks</div>
        <button style={s.iconCircleButton} onClick={onOpenTrash} aria-label="Trash" title="Trash">
          <TrashIcon />
          {trashCount ? <span style={s.badge}>{trashCount}</span> : null}
        </button>
        <button style={s.iconCircleButton} onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <SettingsIcon />
        </button>
      </div>

      {recentNotebooks && recentNotebooks.length > 0 && (
        <>
          <div style={s.sectionTitle}>Recent</div>
          <div style={s.grid}>
            {recentNotebooks.map((n) => (
              <button key={n.id} style={s.pageCard} onClick={() => onOpenNotebook(n.id, n.folderId)}>
                <div style={s.pageCardThumb}>
                  <PageIcon size={28} />
                </div>
                <div style={s.pageCardBody}>
                  <div style={{ fontWeight: 600 }}>{n.name}</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>
                    Opened {new Date(n.lastOpenedAt ?? 0).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={s.sectionTitle}>Folders</div>
      {folders && folders.length === 0 && (
        <div style={s.emptyState}>No folders yet. Use "+ New folder" below to make one.</div>
      )}
      <div style={s.grid}>
        {folders?.map((f) => {
          const count = notebookCounts?.[f.id] ?? 0
          return (
            <button key={f.id} style={{ ...s.card, alignItems: 'center' }} onClick={() => onOpenFolder(f.id)}>
              <FolderIcon color={f.color} size={56} />
              <div style={{ fontWeight: 600 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>
                {count} notebook{count === 1 ? '' : 's'}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ height: 96 }} />

      <div style={s.floatingActions}>
        <button style={s.iconButton} onClick={() => setShowNewFolder(true)}>
          + New folder
        </button>
        <button style={s.primaryButton} onClick={() => setShowNewNotebook(true)}>
          + New notebook
        </button>
      </div>

      {showNewFolder && <NewFolderDialog onSave={handleCreateFolder} onCancel={() => setShowNewFolder(false)} />}
      {showNewNotebook && (
        <NewNotebookDialog onCreate={handleCreateNotebook} onCancel={() => setShowNewNotebook(false)} />
      )}
    </div>
  )
}

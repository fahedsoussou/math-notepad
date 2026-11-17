import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createFolder, createNotebook } from '../storage/db'
import * as s from './styles'
import NewFolderDialog from './NewFolderDialog'

interface Props {
  onOpenFolder: (folderId: string) => void
  onOpenNotebook: (notebookId: string, folderId: string | null) => void
  onOpenTrash: () => void
  onOpenSettings: () => void
}

export default function HomeScreen({ onOpenFolder, onOpenNotebook, onOpenTrash, onOpenSettings }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false)

  const folders = useLiveQuery(() => db.folders.filter((f) => f.deletedAt === null).sortBy('name'), [])
  const recentNotebooks = useLiveQuery(
    () =>
      db.notebooks
        .filter((n) => n.deletedAt === null && n.lastOpenedAt !== null)
        .toArray()
        .then((list) => list.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 8)),
    [],
  )
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

  const handleNewNotebookNoFolder = async () => {
    const name = window.prompt('Notebook name?')
    if (!name?.trim()) return
    // Notebooks created from Home with no folder context go in a virtual
    // "Unfiled" bucket: we still need *a* folder id, so the first folder is
    // used, or one is created automatically if none exist yet.
    let folder = folders?.[0]
    if (!folder) {
      folder = await createFolder('Unfiled', '#71717a')
    }
    const notebook = await createNotebook(folder.id, name.trim())
    onOpenNotebook(notebook.id, folder.id)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Math Notepad</div>
        <button style={s.iconButton} onClick={onOpenSettings}>
          Settings
        </button>
        <button style={s.iconButton} onClick={onOpenTrash}>
          Trash{trashCount ? ` (${trashCount})` : ''}
        </button>
        <button style={s.primaryButton} onClick={() => setShowNewFolder(true)}>
          + Folder
        </button>
      </div>

      {recentNotebooks && recentNotebooks.length > 0 && (
        <>
          <div style={s.sectionTitle}>Recent notebooks</div>
          <div style={s.grid}>
            {recentNotebooks.map((n) => (
              <button key={n.id} style={s.card} onClick={() => onOpenNotebook(n.id, n.folderId)}>
                <div style={{ fontWeight: 600 }}>{n.name}</div>
                <div style={{ fontSize: 12, color: '#71717a' }}>
                  Opened {new Date(n.lastOpenedAt ?? 0).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={s.sectionTitle}>Folders</div>
      {folders && folders.length === 0 && (
        <div style={s.emptyState}>No folders yet. Tap "+ Folder" to make one, or just start a notebook below.</div>
      )}
      <div style={s.grid}>
        {folders?.map((f) => (
          <button key={f.id} style={s.card} onClick={() => onOpenFolder(f.id)}>
            <div
              style={{ width: 20, height: 20, borderRadius: '50%', background: f.color, marginBottom: 4 }}
            />
            <div style={{ fontWeight: 600 }}>{f.name}</div>
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        <button style={s.iconButton} onClick={handleNewNotebookNoFolder}>
          + Quick notebook
        </button>
      </div>

      {showNewFolder && <NewFolderDialog onSave={handleCreateFolder} onCancel={() => setShowNewFolder(false)} />}
    </div>
  )
}

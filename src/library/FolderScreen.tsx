import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  createNotebook,
  renameFolder,
  trashFolder,
  renameNotebook,
  trashNotebook,
  duplicateNotebook,
  moveNotebook,
} from '../storage/db'
import * as s from './styles'
import NewFolderDialog from './NewFolderDialog'
import { useEntity } from './useEntity'

interface Props {
  folderId: string
  onBack: () => void
  onOpenNotebook: (notebookId: string) => void
}

export default function FolderScreen({ folderId, onBack, onOpenNotebook }: Props) {
  const [showEditFolder, setShowEditFolder] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const folder = useEntity(() => db.folders.get(folderId), [folderId])
  const notebooks = useLiveQuery(
    () => db.notebooks.filter((n) => n.folderId === folderId && n.deletedAt === null).sortBy('name'),
    [folderId],
  )
  const otherFolders = useLiveQuery(
    () => db.folders.filter((f) => f.deletedAt === null && f.id !== folderId).sortBy('name'),
    [folderId],
  )

  if (folder === undefined) return null // still loading

  if (!folder) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <button style={s.iconButton} onClick={onBack}>← Back</button>
        </div>
        <div style={s.emptyState}>This folder was deleted.</div>
      </div>
    )
  }

  const handleNewNotebook = async () => {
    const name = window.prompt('Notebook name?')
    if (!name?.trim()) return
    const notebook = await createNotebook(folderId, name.trim())
    onOpenNotebook(notebook.id)
  }

  const handleDeleteFolder = async () => {
    if (!window.confirm(`Move "${folder.name}" and all its notebooks to Trash?`)) return
    await trashFolder(folderId)
    onBack()
  }

  const handleRenameNotebook = async (id: string, currentName: string) => {
    setMenuFor(null)
    const name = window.prompt('Rename notebook', currentName)
    if (!name?.trim()) return
    await renameNotebook(id, name.trim())
  }

  const handleDuplicateNotebook = async (id: string) => {
    setMenuFor(null)
    await duplicateNotebook(id)
  }

  const handleDeleteNotebook = async (id: string, name: string) => {
    setMenuFor(null)
    if (!window.confirm(`Move "${name}" to Trash?`)) return
    await trashNotebook(id)
  }

  const handleMoveNotebook = async (id: string, targetFolderId: string) => {
    setMenuFor(null)
    await moveNotebook(id, targetFolderId)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div
          style={{ width: 16, height: 16, borderRadius: '50%', background: folder.color }}
        />
        <div style={s.headerTitle}>{folder.name}</div>
        <button style={s.iconButton} onClick={() => setShowEditFolder(true)}>Edit</button>
        <button style={s.dangerButton} onClick={handleDeleteFolder}>Delete</button>
        <button style={s.primaryButton} onClick={handleNewNotebook}>+ Notebook</button>
      </div>

      {notebooks && notebooks.length === 0 && (
        <div style={s.emptyState}>No notebooks yet. Tap "+ Notebook" to add one.</div>
      )}

      <div style={s.grid}>
        {notebooks?.map((n) => (
          <div key={n.id} style={{ ...s.card, cursor: 'default' }}>
            <button style={s.cardTitleButton} onClick={() => onOpenNotebook(n.id)}>
              <div style={{ fontWeight: 600 }}>{n.name}</div>
            </button>
            <button style={s.iconButton} onClick={() => setMenuFor(menuFor === n.id ? null : n.id)}>
              ⋯ Options
            </button>
            {menuFor === n.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <button style={s.iconButton} onClick={() => handleRenameNotebook(n.id, n.name)}>Rename</button>
                <button style={s.iconButton} onClick={() => handleDuplicateNotebook(n.id)}>Duplicate</button>
                {otherFolders && otherFolders.length > 0 && (
                  <select
                    defaultValue=""
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8' }}
                    onChange={(e) => e.target.value && handleMoveNotebook(n.id, e.target.value)}
                  >
                    <option value="" disabled>Move to…</option>
                    {otherFolders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
                <button style={s.dangerButton} onClick={() => handleDeleteNotebook(n.id, n.name)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showEditFolder && (
        <NewFolderDialog
          initialName={folder.name}
          initialColor={folder.color}
          onSave={async (name, color) => {
            setShowEditFolder(false)
            await renameFolder(folderId, name)
            await db.folders.update(folderId, { color })
          }}
          onCancel={() => setShowEditFolder(false)}
        />
      )}
    </div>
  )
}

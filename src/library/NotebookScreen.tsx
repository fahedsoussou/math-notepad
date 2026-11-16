import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createPage, renamePage, trashPage, duplicatePage, touchNotebookOpened } from '../storage/db'
import * as s from './styles'

interface Props {
  notebookId: string
  onBack: () => void
  onOpenPage: (pageId: string) => void
}

export default function NotebookScreen({ notebookId, onBack, onOpenPage }: Props) {
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const notebook = useLiveQuery(() => db.notebooks.get(notebookId), [notebookId])
  const pages = useLiveQuery(
    () => db.pages.filter((p) => p.notebookId === notebookId && p.deletedAt === null).sortBy('order'),
    [notebookId],
  )

  useEffect(() => {
    touchNotebookOpened(notebookId)
  }, [notebookId])

  if (!notebook) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <button style={s.iconButton} onClick={onBack}>← Back</button>
        </div>
        <div style={s.emptyState}>This notebook was deleted.</div>
      </div>
    )
  }

  const handleNewPage = async () => {
    const page = await createPage(notebookId)
    onOpenPage(page.id)
  }

  const handleRename = async (id: string, currentTitle: string) => {
    setMenuFor(null)
    const title = window.prompt('Rename page', currentTitle)
    if (!title?.trim()) return
    await renamePage(id, title.trim())
  }

  const handleDuplicate = async (id: string) => {
    setMenuFor(null)
    await duplicatePage(id)
  }

  const handleDelete = async (id: string, title: string) => {
    setMenuFor(null)
    if (!window.confirm(`Move "${title}" to Trash?`)) return
    await trashPage(id)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>{notebook.name}</div>
        <button style={s.primaryButton} onClick={handleNewPage}>+ Page</button>
      </div>

      {pages && pages.length === 0 && (
        <div style={s.emptyState}>No pages yet. Tap "+ Page" to start writing.</div>
      )}

      <div style={s.grid}>
        {pages?.map((p, i) => (
          <div key={p.id} style={{ ...s.card, cursor: 'default' }}>
            <button style={s.cardTitleButton} onClick={() => onOpenPage(p.id)}>
              <div style={{ fontWeight: 600 }}>{p.title || `Page ${i + 1}`}</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>
                Updated {new Date(p.updatedAt).toLocaleDateString()}
              </div>
            </button>
            <button style={s.iconButton} onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}>
              ⋯ Options
            </button>
            {menuFor === p.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <button style={s.iconButton} onClick={() => handleRename(p.id, p.title)}>Rename</button>
                <button style={s.iconButton} onClick={() => handleDuplicate(p.id)}>Duplicate</button>
                <button style={s.dangerButton} onClick={() => handleDelete(p.id, p.title)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

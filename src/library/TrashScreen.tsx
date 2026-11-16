import { useLiveQuery } from 'dexie-react-hooks'
import { db, restoreFolder, restoreNotebook, restorePage, emptyTrash } from '../storage/db'
import * as s from './styles'

interface Props {
  onBack: () => void
}

export default function TrashScreen({ onBack }: Props) {
  const folders = useLiveQuery(() => db.folders.filter((f) => f.deletedAt !== null).sortBy('name'), [])
  const notebooks = useLiveQuery(() => db.notebooks.filter((n) => n.deletedAt !== null).sortBy('name'), [])
  const pages = useLiveQuery(() => db.pages.filter((p) => p.deletedAt !== null).sortBy('title'), [])

  const isEmpty = (folders?.length ?? 0) === 0 && (notebooks?.length ?? 0) === 0 && (pages?.length ?? 0) === 0

  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete everything in Trash? This cannot be undone.')) return
    await emptyTrash()
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>Trash</div>
        <button style={s.dangerButton} onClick={handleEmptyTrash} disabled={isEmpty}>
          Empty Trash
        </button>
      </div>

      {isEmpty && <div style={s.emptyState}>Trash is empty.</div>}

      {folders && folders.length > 0 && (
        <>
          <div style={s.sectionTitle}>Folders</div>
          <div style={s.grid}>
            {folders.map((f) => (
              <div key={f.id} style={s.card}>
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <button style={s.iconButton} onClick={() => restoreFolder(f.id)}>Restore</button>
              </div>
            ))}
          </div>
        </>
      )}

      {notebooks && notebooks.length > 0 && (
        <>
          <div style={s.sectionTitle}>Notebooks</div>
          <div style={s.grid}>
            {notebooks.map((n) => (
              <div key={n.id} style={s.card}>
                <div style={{ fontWeight: 600 }}>{n.name}</div>
                <button style={s.iconButton} onClick={() => restoreNotebook(n.id)}>Restore</button>
              </div>
            ))}
          </div>
        </>
      )}

      {pages && pages.length > 0 && (
        <>
          <div style={s.sectionTitle}>Pages</div>
          <div style={s.grid}>
            {pages.map((p) => (
              <div key={p.id} style={s.card}>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <button style={s.iconButton} onClick={() => restorePage(p.id)}>Restore</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

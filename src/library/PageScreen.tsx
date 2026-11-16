import { db } from '../storage/db'
import InkCanvas from '../canvas/InkCanvas'
import * as s from './styles'
import { useEntity } from './useEntity'

interface Props {
  pageId: string
  onBack: () => void
}

export default function PageScreen({ pageId, onBack }: Props) {
  const page = useEntity(() => db.pages.get(pageId), [pageId])

  if (page === undefined) return null // still loading

  if (!page) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <button style={s.iconButton} onClick={onBack}>← Back</button>
        </div>
        <div style={s.emptyState}>This page was deleted.</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f4f4f5', color: '#1e1e2e' }}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>{page.title}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <InkCanvas pageId={pageId} background={page.background ?? 'blank'} />
      </div>
    </div>
  )
}

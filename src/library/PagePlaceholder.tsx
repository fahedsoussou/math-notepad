import * as s from './styles'

interface Props {
  pageId: string
  onBack: () => void
}

/**
 * Temporary stand-in for the real page view. The infinite ink canvas (pan/
 * zoom, pen tools, symbol palette, autosave) is the next step in Phase 1A —
 * this placeholder exists only so Library navigation (create/open/rename/
 * delete pages) can be tested end-to-end before that lands.
 */
export default function PagePlaceholder({ pageId, onBack }: Props) {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>Page</div>
      </div>
      <div style={s.emptyState}>
        Page id: {pageId}
        <br />
        The ink canvas for writing on this page comes next.
      </div>
    </div>
  )
}

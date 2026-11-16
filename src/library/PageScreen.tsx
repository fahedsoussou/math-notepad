import { useState } from 'react'
import { db, setPageBackground, type PageBackground } from '../storage/db'
import InkCanvas from '../canvas/InkCanvas'
import * as s from './styles'
import { useEntity } from './useEntity'

interface Props {
  pageId: string
  onBack: () => void
}

const BACKGROUND_LABELS: Record<PageBackground, string> = {
  blank: 'Blank',
  lined: 'Lined',
  grid: 'Grid',
  dotted: 'Dotted',
}

export default function PageScreen({ pageId, onBack }: Props) {
  const page = useEntity(() => db.pages.get(pageId), [pageId])
  const [showBgMenu, setShowBgMenu] = useState(false)

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

  const background = page.background ?? 'blank'

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f4f4f5', color: '#1e1e2e' }}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>{page.title}</div>
        <div style={{ position: 'relative' }}>
          <button style={s.iconButton} onClick={() => setShowBgMenu((v) => !v)}>
            Background: {BACKGROUND_LABELS[background]}
          </button>
          {showBgMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'white',
                border: '1px solid #e4e4e7',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 120,
              }}
            >
              {(Object.keys(BACKGROUND_LABELS) as PageBackground[]).map((bg) => (
                <button
                  key={bg}
                  onClick={() => {
                    setPageBackground(pageId, bg)
                    setShowBgMenu(false)
                  }}
                  style={{
                    border: 'none',
                    background: bg === background ? '#eceef1' : 'white',
                    color: '#1e1e2e',
                    padding: '10px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {BACKGROUND_LABELS[bg]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <InkCanvas pageId={pageId} background={background} />
      </div>
    </div>
  )
}

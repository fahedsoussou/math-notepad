import { useState } from 'react'
import { db, setPageBackground, setPaperColor, type PageBackground, type PaperColor } from '../storage/db'
import InkCanvas from '../canvas/InkCanvas'
import { PAPER_COLORS } from '../canvas/background'
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

const PAPER_COLOR_LABELS: Record<PaperColor, string> = {
  white: 'White',
  black: 'Black (OLED)',
  blue: 'Blue',
  graphite: 'Graphite',
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
  const paperColor = page.paperColor ?? 'white'

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f4f6f9', color: '#1e1e2e' }}>
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
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #e4e4e7' }}>
                {(Object.keys(PAPER_COLOR_LABELS) as PaperColor[]).map((pc) => (
                  <button
                    key={pc}
                    onClick={() => setPaperColor(pageId, pc)}
                    aria-label={PAPER_COLOR_LABELS[pc]}
                    title={PAPER_COLOR_LABELS[pc]}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: PAPER_COLORS[pc].fill,
                      border: pc === paperColor ? '2px solid #2563eb' : '1px solid #d4d4d8',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <InkCanvas pageId={pageId} background={background} paperColor={paperColor} />
      </div>
    </div>
  )
}

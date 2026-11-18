import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  setPageBackground,
  setPaperColor,
  duplicatePage,
  insertPageAfter,
  trashPage,
  type PageBackground,
  type PaperColor,
} from '../storage/db'
import InkCanvas from '../canvas/InkCanvas'
import { PAPER_COLORS } from '../canvas/background'
import { exportPagePDF, exportPagePNG } from '../canvas/pdfExport'
import * as s from './styles'
import { useEntity } from './useEntity'
import MathPanel from '../math-engine/MathPanel'

interface Props {
  pageId: string
  notebookId: string
  onBack: () => void
  onNavigatePage: (pageId: string) => void
}

const BACKGROUND_LABELS: Record<PageBackground, string> = {
  blank: 'Blank',
  lined: 'Lined',
  grid: 'Grid',
  dotted: 'Dotted',
  cornell: 'Cornell',
}

const PAPER_COLOR_LABELS: Record<PaperColor, string> = {
  white: 'White',
  black: 'Black (OLED)',
  blue: 'Blue',
  graphite: 'Graphite',
}

export default function PageScreen({ pageId, notebookId, onBack, onNavigatePage }: Props) {
  const page = useEntity(() => db.pages.get(pageId), [pageId])
  const siblingPages = useLiveQuery(
    () => db.pages.filter((p) => p.notebookId === notebookId && p.deletedAt === null).sortBy('order'),
    [notebookId],
  )
  const [showBgMenu, setShowBgMenu] = useState(false)
  const [showMathPanel, setShowMathPanel] = useState(false)

  const pageIndex = siblingPages?.findIndex((p) => p.id === pageId) ?? -1
  const pageCount = siblingPages?.length ?? 0

  const handlePrevPage = () => {
    if (siblingPages && pageIndex > 0) onNavigatePage(siblingPages[pageIndex - 1].id)
  }
  const handleNextPage = () => {
    if (siblingPages && pageIndex >= 0 && pageIndex < siblingPages.length - 1) onNavigatePage(siblingPages[pageIndex + 1].id)
  }
  const handleDuplicatePage = async () => {
    const copy = await duplicatePage(pageId)
    if (copy) onNavigatePage(copy.id)
  }
  const handleInsertPageAfter = async () => {
    const created = await insertPageAfter(pageId)
    if (created) onNavigatePage(created.id)
  }
  const handleDeletePage = async () => {
    if (!window.confirm('Move this page to Trash?')) return
    await trashPage(pageId)
    onBack()
  }
  const handleExportPagePDF = async () => {
    try {
      await exportPagePDF(pageId)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not export this page as a PDF.')
    }
  }
  const handleExportPagePNG = async () => {
    try {
      await exportPagePNG(pageId)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not export this page as a PNG.')
    }
  }

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
  const lineSpacing = page.lineSpacing ?? 'medium'
  const marginLine = page.marginLine ?? false

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f4f6f9', color: '#1e1e2e' }}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>{page.title}</div>
        <button style={s.iconButton} onClick={() => setShowMathPanel(true)}>Math</button>
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
        <InkCanvas
          pageId={pageId}
          background={background}
          paperColor={paperColor}
          lineSpacing={lineSpacing}
          marginLine={marginLine}
          pageIndex={pageIndex}
          pageCount={pageCount}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onDuplicatePage={handleDuplicatePage}
          onInsertPageAfter={handleInsertPageAfter}
          onDeletePage={handleDeletePage}
          onExportPagePDF={handleExportPagePDF}
          onExportPagePNG={handleExportPagePNG}
        />
      </div>
      {showMathPanel && <MathPanel onClose={() => setShowMathPanel(false)} />}
    </div>
  )
}

import { useState } from 'react'
import type { Tool } from './InkCanvas'
import {
  PEN_COLORS,
  HIGHLIGHTER_COLORS,
  PEN_SIZES,
  HIGHLIGHTER_SIZES,
  PEN_TYPES,
  PEN_TYPE_LABELS,
} from './colors'
import { ACCENT } from '../library/styles'
import type { PenType } from '../storage/db'
import {
  PenIcon,
  HighlighterIcon,
  EraserIcon,
  LassoIcon,
  UndoIcon,
  RedoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  OverflowIcon,
} from '../library/icons'

interface Props {
  tool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
  size: number
  onSizeChange: (size: number) => void
  penType: PenType
  onPenTypeChange: (penType: PenType) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  scratchOutEnabled: boolean
  onToggleScratchOut: () => void
  onToggleSymbolPalette: () => void
  hasSelection: boolean
  onDuplicateSelection: () => void
  onDeleteSelection: () => void
  pageIndex: number
  pageCount: number
  onPrevPage: () => void
  onNextPage: () => void
  onDuplicatePage: () => void
  onInsertPageAfter: () => void
  onDeletePage: () => void
}

const barStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  left: 10,
  right: 10,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.95)',
  boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
  zIndex: 5,
}

function toolButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 8,
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: active ? ACCENT : '#e6eaf0',
    color: active ? 'white' : '#1e1e2e',
  }
}

const menuItemStyle: React.CSSProperties = {
  border: 'none',
  background: 'white',
  color: '#1e1e2e',
  padding: '10px 14px',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: 14,
  whiteSpace: 'nowrap',
}

export default function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  penType,
  onPenTypeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  scratchOutEnabled,
  onToggleScratchOut,
  onToggleSymbolPalette,
  hasSelection,
  onDuplicateSelection,
  onDeleteSelection,
  pageIndex,
  pageCount,
  onPrevPage,
  onNextPage,
  onDuplicatePage,
  onInsertPageAfter,
  onDeletePage,
}: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const colors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS
  const sizes = tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES
  const showDrawingControls = tool === 'pen' || tool === 'highlighter'

  return (
    <div style={barStyle}>
      <button style={toolButtonStyle(tool === 'pen')} onClick={() => onToolChange('pen')} aria-label="Pen" title="Pen">
        <PenIcon />
      </button>
      <button
        style={toolButtonStyle(tool === 'highlighter')}
        onClick={() => onToolChange('highlighter')}
        aria-label="Highlighter"
        title="Highlighter"
      >
        <HighlighterIcon />
      </button>
      <button
        style={toolButtonStyle(tool === 'eraser')}
        onClick={() => onToolChange('eraser')}
        aria-label="Eraser"
        title="Eraser"
      >
        <EraserIcon />
      </button>
      <button style={toolButtonStyle(tool === 'lasso')} onClick={() => onToolChange('lasso')} aria-label="Lasso" title="Lasso">
        <LassoIcon />
      </button>
      <button style={toolButtonStyle(false)} onClick={onToggleSymbolPalette} aria-label="Open symbol palette" title="Symbols">
        <span style={{ fontSize: 18 }}>Ω</span>
      </button>

      {tool === 'lasso' && hasSelection && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...toolButtonStyle(false), width: 'auto', padding: '0 12px', fontSize: 14 }} onClick={onDuplicateSelection}>
            Duplicate
          </button>
          <button
            style={{ ...toolButtonStyle(false), width: 'auto', padding: '0 12px', fontSize: 14, background: '#fde2e2', color: '#9b1c1c' }}
            onClick={onDeleteSelection}
          >
            Delete
          </button>
        </div>
      )}

      {tool === 'pen' && (
        <select
          value={penType}
          onChange={(e) => onPenTypeChange(e.target.value as PenType)}
          aria-label="Pen type"
          style={{
            border: '1px solid #d7dde5',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 14,
            color: '#1e1e2e',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          {PEN_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {PEN_TYPE_LABELS[pt]}
            </option>
          ))}
        </select>
      )}

      {showDrawingControls && (
        <div style={{ display: 'flex', gap: 6 }}>
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              aria-label={`Colour ${c}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: c,
                border: color === c ? `3px solid ${ACCENT}` : '3px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      {showDrawingControls && (
        <div style={{ display: 'flex', gap: 6 }}>
          {sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => onSizeChange(sz)}
              aria-label={`Size ${sz}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: size === sz ? `2px solid ${ACCENT}` : '2px solid #e4e4e7',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: Math.min(sz, 20),
                  height: Math.min(sz, 20),
                  borderRadius: '50%',
                  background: '#1e1e2e',
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={{ ...toolButtonStyle(false), opacity: canUndo ? 1 : 0.4 }} onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo">
          <UndoIcon />
        </button>
        <button style={{ ...toolButtonStyle(false), opacity: canRedo ? 1 : 0.4 }} onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo">
          <RedoIcon />
        </button>

        <button
          style={{ ...toolButtonStyle(false), width: 'auto', padding: '0 4px', opacity: pageIndex > 0 ? 1 : 0.4 }}
          onClick={onPrevPage}
          disabled={pageIndex <= 0}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span style={{ fontSize: 13, color: '#4b5563', minWidth: 36, textAlign: 'center' }}>
          {pageCount > 0 ? `${pageIndex + 1}/${pageCount}` : '0/0'}
        </span>
        <button
          style={{ ...toolButtonStyle(false), width: 'auto', padding: '0 4px', opacity: pageIndex < pageCount - 1 ? 1 : 0.4 }}
          onClick={onNextPage}
          disabled={pageIndex >= pageCount - 1}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRightIcon size={18} />
        </button>

        <div style={{ position: 'relative' }}>
          <button style={toolButtonStyle(false)} onClick={() => setShowMenu((v) => !v)} aria-label="More options" title="More">
            <OverflowIcon />
          </button>
          {showMenu && (
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
              }}
            >
              <button
                style={menuItemStyle}
                onClick={() => {
                  setShowMenu(false)
                  onToggleScratchOut()
                }}
              >
                Scratch-out: {scratchOutEnabled ? 'On' : 'Off'}
              </button>
              <button
                style={menuItemStyle}
                onClick={() => {
                  setShowMenu(false)
                  onInsertPageAfter()
                }}
              >
                Insert page after this one
              </button>
              <button
                style={menuItemStyle}
                onClick={() => {
                  setShowMenu(false)
                  onDuplicatePage()
                }}
              >
                Duplicate page
              </button>
              <button
                style={{ ...menuItemStyle, color: '#9b1c1c' }}
                onClick={() => {
                  setShowMenu(false)
                  onDeletePage()
                }}
              >
                Delete page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
    padding: '8px 12px',
    fontSize: 14,
    cursor: 'pointer',
    background: active ? ACCENT : '#e6eaf0',
    color: active ? 'white' : '#1e1e2e',
  }
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
}: Props) {
  const colors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS
  const sizes = tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES
  const showDrawingControls = tool === 'pen' || tool === 'highlighter'

  return (
    <div style={barStyle}>
      <button style={toolButtonStyle(tool === 'pen')} onClick={() => onToolChange('pen')}>
        Pen
      </button>
      <button style={toolButtonStyle(tool === 'highlighter')} onClick={() => onToolChange('highlighter')}>
        Highlighter
      </button>
      <button style={toolButtonStyle(tool === 'eraser')} onClick={() => onToolChange('eraser')}>
        Eraser
      </button>
      <button style={toolButtonStyle(tool === 'lasso')} onClick={() => onToolChange('lasso')}>
        Lasso
      </button>
      <button style={toolButtonStyle(false)} onClick={onToggleSymbolPalette} aria-label="Open symbol palette">
        Ω Symbols
      </button>

      {tool === 'lasso' && hasSelection && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toolButtonStyle(false)} onClick={onDuplicateSelection}>
            Duplicate
          </button>
          <button
            style={{ ...toolButtonStyle(false), background: '#fde2e2', color: '#9b1c1c' }}
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

      <button
        style={toolButtonStyle(scratchOutEnabled)}
        onClick={onToggleScratchOut}
        aria-label="Toggle scratch-out to erase"
      >
        Scratch-out: {scratchOutEnabled ? 'On' : 'Off'}
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          style={{ ...toolButtonStyle(false), opacity: canUndo ? 1 : 0.4 }}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
        >
          Undo
        </button>
        <button
          style={{ ...toolButtonStyle(false), opacity: canRedo ? 1 : 0.4 }}
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
        >
          Redo
        </button>
      </div>
    </div>
  )
}

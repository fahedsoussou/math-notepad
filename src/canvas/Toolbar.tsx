import type { Tool } from './InkCanvas'
import { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_SIZES, HIGHLIGHTER_SIZES } from './colors'

interface Props {
  tool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
  size: number
  onSizeChange: (size: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
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
    background: active ? '#1e1e2e' : '#eceef1',
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const colors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS
  const sizes = tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES

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

      {tool !== 'eraser' && (
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
                border: color === c ? '3px solid #1e1e2e' : '3px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      {tool !== 'eraser' && (
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
                border: size === sz ? '2px solid #1e1e2e' : '2px solid #e4e4e7',
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

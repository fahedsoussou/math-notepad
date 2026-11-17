import { GREEK_LOWER, GREEK_UPPER, OPERATORS } from './symbols'

interface Props {
  onDragStart: (char: string, clientX: number, clientY: number) => void
  onClose: () => void
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 60,
  left: 10,
  right: 10,
  maxHeight: '60%',
  overflowY: 'auto',
  background: 'rgba(255,255,255,0.98)',
  borderRadius: 12,
  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  padding: 12,
  zIndex: 6,
  color: '#1e1e2e',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  margin: '8px 0 4px',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
  gap: 6,
}

const charButtonStyle: React.CSSProperties = {
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  background: 'white',
  color: '#1e1e2e',
  fontSize: 20,
  padding: '8px 0',
  cursor: 'grab',
  touchAction: 'none', // the drag itself handles panning/scrolling, not the browser
}

/**
 * Press a symbol and drag it onto the page to place it there — see
 * InkCanvas's drag handling (draggingSymbol state + window pointermove/up
 * listeners). A plain tap is also a tiny drag that ends on the same
 * button, which InkCanvas's drop logic already treats as "not over the
 * canvas" and ignores, so nothing is placed by tapping alone.
 */
export default function SymbolPalette({ onDragStart, onClose }: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Symbols</strong>
        <button
          onClick={onClose}
          style={{ border: 'none', background: '#eceef1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#1e1e2e' }}
        >
          Close
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#71717a', margin: '4px 0 8px' }}>
        Press and drag a symbol onto the page to place it.
      </div>

      <div style={rowLabelStyle}>Greek — lower case</div>
      <div style={gridStyle}>
        {GREEK_LOWER.map((c) => (
          <button key={c} style={charButtonStyle} onPointerDown={(e) => onDragStart(c, e.clientX, e.clientY)}>
            {c}
          </button>
        ))}
      </div>

      <div style={rowLabelStyle}>Greek — upper case</div>
      <div style={gridStyle}>
        {GREEK_UPPER.map((c) => (
          <button key={c} style={charButtonStyle} onPointerDown={(e) => onDragStart(c, e.clientX, e.clientY)}>
            {c}
          </button>
        ))}
      </div>

      <div style={rowLabelStyle}>Operators</div>
      <div style={gridStyle}>
        {OPERATORS.map((c) => (
          <button key={c} style={charButtonStyle} onPointerDown={(e) => onDragStart(c, e.clientX, e.clientY)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

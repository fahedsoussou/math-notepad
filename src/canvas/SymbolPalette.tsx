import { GREEK_LOWER, GREEK_UPPER, OPERATORS } from './symbols'

interface Props {
  onPick: (char: string) => void
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
  cursor: 'pointer',
}

/** Tapping a symbol places it on the page immediately — see InkCanvas's placeSymbol. */
export default function SymbolPalette({ onPick, onClose }: Props) {
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

      <div style={rowLabelStyle}>Greek — lower case</div>
      <div style={gridStyle}>
        {GREEK_LOWER.map((c) => (
          <button key={c} style={charButtonStyle} onClick={() => onPick(c)}>
            {c}
          </button>
        ))}
      </div>

      <div style={rowLabelStyle}>Greek — upper case</div>
      <div style={gridStyle}>
        {GREEK_UPPER.map((c) => (
          <button key={c} style={charButtonStyle} onClick={() => onPick(c)}>
            {c}
          </button>
        ))}
      </div>

      <div style={rowLabelStyle}>Operators</div>
      <div style={gridStyle}>
        {OPERATORS.map((c) => (
          <button key={c} style={charButtonStyle} onClick={() => onPick(c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

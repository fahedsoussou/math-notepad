import { useRef, useState } from 'react'
import type { PageBackground, PaperColor, LineSpacing, NotebookDefaults } from '../storage/db'
import { PAPER_COLORS } from '../canvas/background'
import { ACCENT } from './styles'

interface Props {
  onCreate: (name: string, defaults: NotebookDefaults) => void
  onCancel: () => void
}

const PATTERNS: { value: PageBackground; label: string; preview: React.CSSProperties }[] = [
  { value: 'blank', label: 'Blank', preview: {} },
  {
    value: 'lined',
    label: 'Lined',
    preview: { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 9px, #c7cdd6 9px 10px)' },
  },
  {
    value: 'grid',
    label: 'Grid',
    preview: {
      backgroundImage:
        'repeating-linear-gradient(to bottom, transparent 0 9px, #c7cdd6 9px 10px), repeating-linear-gradient(to right, transparent 0 9px, #c7cdd6 9px 10px)',
    },
  },
  {
    value: 'dotted',
    label: 'Dotted',
    preview: {
      backgroundImage: 'radial-gradient(#c7cdd6 1px, transparent 1.5px)',
      backgroundSize: '10px 10px',
    },
  },
  {
    value: 'cornell',
    label: 'Cornell',
    preview: {
      backgroundImage:
        'repeating-linear-gradient(to bottom, transparent 0 9px, #c7cdd6 9px 10px), linear-gradient(to right, transparent 0 30%, #c7cdd6 30% calc(30% + 1.5px), transparent calc(30% + 1.5px))',
    },
  },
]

const PAPER_PRESETS: { value: PaperColor; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black (OLED)' },
  { value: 'blue', label: 'Blue' },
  { value: 'graphite', label: 'Graphite' },
]

const SPACINGS: { value: LineSpacing; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
  { value: 'xwide', label: 'Extra wide' },
]

export default function NewNotebookDialog({ onCreate, onCancel }: Props) {
  const [name, setName] = useState(`Notes ${new Date().toLocaleDateString()}`)
  const [background, setBackground] = useState<PageBackground>('blank')
  const [paperColor, setPaperColor] = useState<PaperColor>('white')
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('medium')
  const [marginLine, setMarginLine] = useState(false)
  const customColorRef = useRef<HTMLInputElement | null>(null)
  const isCustomColor = !PAPER_PRESETS.some((p) => p.value === paperColor)

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), { background, paperColor, lineSpacing, marginLine })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 440,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#1e1e2e',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>New notebook</div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>Title</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d7dde5',
              fontSize: 15,
              background: 'white',
              color: '#1e1e2e',
            }}
          />
        </label>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Pattern</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PATTERNS.map((p) => (
              <button
                key={p.value}
                onClick={() => setBackground(p.value)}
                style={{
                  border: background === p.value ? `2px solid ${ACCENT}` : '2px solid #e6eaf0',
                  borderRadius: 8,
                  padding: 4,
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  width: 64,
                }}
              >
                <div style={{ width: 52, height: 64, background: 'white', ...p.preview }} />
                <span style={{ fontSize: 11, color: '#1e1e2e' }}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Paper colour</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {PAPER_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPaperColor(p.value)}
                aria-label={p.label}
                title={p.label}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: PAPER_COLORS[p.value].fill,
                  border: paperColor === p.value ? `2px solid ${ACCENT}` : '1px solid #d7dde5',
                  cursor: 'pointer',
                }}
              />
            ))}
            <button
              onClick={() => customColorRef.current?.click()}
              aria-label="Choose a custom colour"
              title="Choose…"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                border: isCustomColor ? `2px solid ${ACCENT}` : '1px solid #d7dde5',
                cursor: 'pointer',
              }}
            />
            <input
              ref={customColorRef}
              type="color"
              value={isCustomColor ? paperColor : '#f4f4f5'}
              onChange={(e) => setPaperColor(e.target.value)}
              style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>Line spacing</div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
            {SPACINGS.map((sp) => (
              <button
                key={sp.value}
                onClick={() => setLineSpacing(sp.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  padding: '8px 0',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: lineSpacing === sp.value ? ACCENT : '#e6eaf0',
                  color: lineSpacing === sp.value ? 'white' : '#1e1e2e',
                }}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Margin line</div>
            <div style={{ fontSize: 12, color: '#71717a' }}>A red vertical margin line, like ruled paper</div>
          </div>
          <input type="checkbox" checked={marginLine} onChange={(e) => setMarginLine(e.target.checked)} style={{ width: 20, height: 20 }} />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: 'none', color: '#1e1e2e', padding: '10px 16px', fontSize: 15, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{ border: 'none', background: ACCENT, color: 'white', borderRadius: 8, padding: '10px 20px', fontSize: 15, cursor: 'pointer' }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

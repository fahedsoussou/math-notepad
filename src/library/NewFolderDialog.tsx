import { useState } from 'react'
import { FOLDER_COLORS } from './colors'
import { ACCENT } from './styles'

interface Props {
  initialName?: string
  initialColor?: string
  onSave: (name: string, color: string) => void
  onCancel: () => void
}

/** Small overlay form for naming a folder and picking its colour. */
export default function NewFolderDialog({ initialName = '', initialColor, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor ?? FOLDER_COLORS[0])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: 'white', borderRadius: 14, padding: 20, width: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Folder</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            fontSize: 16,
            borderRadius: 8,
            border: '1px solid #d4d4d8',
            marginBottom: 14,
          }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: c,
                border: color === c ? `3px solid ${ACCENT}` : '3px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: '#eceef1', borderRadius: 8, padding: '10px 16px', fontSize: 15, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), color)}
            style={{ border: 'none', background: ACCENT, color: 'white', borderRadius: 8, padding: '10px 16px', fontSize: 15, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

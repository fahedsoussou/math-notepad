import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../storage/db'
import { downloadBackup, parseBackupFile, importBackup } from '../storage/backup'
import * as s from './styles'

interface Props {
  onBack: () => void
}

const sectionStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  border: '1px solid #e4e4e7',
  padding: 16,
  margin: '0 16px 16px',
  color: '#1e1e2e',
}

const labelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 6,
}

const helpStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#71717a',
  marginBottom: 10,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: 15,
  borderRadius: 8,
  border: '1px solid #d4d4d8',
  fontFamily: 'monospace',
}

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: 'none',
    padding: '10px 0',
    fontSize: 15,
    cursor: 'pointer',
    background: active ? '#1e1e2e' : '#eceef1',
    color: active ? 'white' : '#1e1e2e',
  }
}

export default function SettingsScreen({ onBack }: Props) {
  const settings = useLiveQuery(() => getSettings(), []) ?? DEFAULT_SETTINGS

  // Local editing buffer for the key field, so typing doesn't write to
  // Dexie on every keystroke; committed on blur or the Save button.
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)

  useEffect(() => {
    setKeyDraft(settings.geminiApiKey ?? '')
  }, [settings.geminiApiKey])

  const saveKey = async () => {
    await updateSettings({ geminiApiKey: keyDraft.trim() || null })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  const clearKey = async () => {
    setKeyDraft('')
    await updateSettings({ geminiApiKey: null })
  }

  const handleExport = async () => {
    setBackupStatus('Preparing backup…')
    try {
      await downloadBackup()
      setBackupStatus('Backup downloaded.')
    } catch {
      setBackupStatus('Could not create the backup file.')
    }
    setTimeout(() => setBackupStatus(null), 3000)
  }

  const handleImportFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return

    try {
      const backup = await parseBackupFile(file)
      const total = backup.folders.length + backup.notebooks.length + backup.pages.length
      const ok = window.confirm(
        `Import this backup (from ${new Date(backup.exportedAt).toLocaleString()})?\n\n` +
          `It has ${backup.folders.length} folder(s), ${backup.notebooks.length} notebook(s), and ` +
          `${backup.pages.length} page(s) (${total} items total). This adds to your current library — ` +
          `it won't delete anything you have now.`,
      )
      if (!ok) return

      setBackupStatus('Importing…')
      await importBackup(backup)
      setBackupStatus('Backup imported.')
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Could not import that file.')
    }
    setTimeout(() => setBackupStatus(null), 4000)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.iconButton} onClick={onBack}>← Back</button>
        <div style={s.headerTitle}>Settings</div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <div style={sectionStyle}>
          <div style={labelStyle}>Gemini API key</div>
          <div style={helpStyle}>
            Optional, for AI assist when online (not used yet). Stored only on this device —
            never leaves it except directly to Google when you use an AI feature, and never
            goes into the app's code or GitHub.
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={saveKey}
            placeholder="Paste your Gemini API key"
            style={inputStyle}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={s.iconButton} onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button style={s.primaryButton} onClick={saveKey}>
              {savedFlash ? 'Saved' : 'Save'}
            </button>
            {settings.geminiApiKey && (
              <button style={s.dangerButton} onClick={clearKey}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>Suggestions while writing</div>
          <div style={helpStyle}>
            Suggest mode shows quick-action chips (Plot, Solve, etc.) next to what you write.
            Quiet mode turns that off — fully manual. (Not wired up to the canvas yet.)
          </div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
            <button
              style={segmentButtonStyle(settings.suggestMode)}
              onClick={() => updateSettings({ suggestMode: true })}
            >
              Suggest mode
            </button>
            <button
              style={segmentButtonStyle(!settings.suggestMode)}
              onClick={() => updateSettings({ suggestMode: false })}
            >
              Quiet mode
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>Dark mode</div>
          <div style={helpStyle}>
            Saved for later — the app doesn't change its theme yet, this just remembers your
            preference for when it does.
          </div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
            <button
              style={segmentButtonStyle(!settings.darkMode)}
              onClick={() => updateSettings({ darkMode: false })}
            >
              Light
            </button>
            <button
              style={segmentButtonStyle(settings.darkMode)}
              onClick={() => updateSettings({ darkMode: true })}
            >
              Dark
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>Library backup</div>
          <div style={helpStyle}>
            Export every folder, notebook, and page (including Trash) as one file you can keep
            safe or move to another device. Importing adds a backup's contents to what you have
            now — it never deletes anything. (The Gemini key above is never included in a
            backup file.)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={s.primaryButton} onClick={handleExport}>
              Export backup
            </button>
            <button style={s.iconButton} onClick={() => fileInputRef.current?.click()}>
              Import backup…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImportFileChosen}
            />
          </div>
          {backupStatus && <div style={{ ...helpStyle, marginTop: 10, marginBottom: 0 }}>{backupStatus}</div>}
        </div>
      </div>
    </div>
  )
}

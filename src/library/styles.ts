// Shared inline-style building blocks for the library screens. Kept as plain
// style objects (no CSS framework) to match the rest of Phase 0/1A and to
// stay touch-friendly on the tablet (big tap targets, high contrast).

import type { CSSProperties } from 'react'

export const page: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflowY: 'auto',
  background: '#f4f4f5',
  fontFamily: 'sans-serif',
  color: '#1e1e2e',
}

export const header: CSSProperties = {
  position: 'sticky',
  top: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  background: '#ffffff',
  borderBottom: '1px solid #e4e4e7',
  zIndex: 1,
}

export const headerTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  flex: 1,
}

export const iconButton: CSSProperties = {
  border: 'none',
  background: '#eceef1',
  color: '#1e1e2e',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 16,
  cursor: 'pointer',
}

export const primaryButton: CSSProperties = {
  border: 'none',
  background: '#1e1e2e',
  color: 'white',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 16,
  cursor: 'pointer',
}

export const dangerButton: CSSProperties = {
  ...iconButton,
  background: '#fde2e2',
  color: '#9b1c1c',
}

export const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
  padding: 16,
}

export const sectionTitle: CSSProperties = {
  padding: '12px 16px 4px',
  fontSize: 14,
  fontWeight: 600,
  color: '#52525b',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

export const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 14,
  borderRadius: 12,
  background: 'white',
  border: '1px solid #e4e4e7',
  cursor: 'pointer',
  textAlign: 'left',
}

export const emptyState: CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: '#71717a',
}

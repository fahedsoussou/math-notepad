// Shared inline-style building blocks for the library screens. Kept as plain
// style objects (no CSS framework) to match the rest of Phase 0/1A and to
// stay touch-friendly on the tablet (big tap targets, high contrast).

import type { CSSProperties } from 'react'

// Ink-blue accent, borrowed (as a style choice, not code) from Tratto's
// look — a neutral, cool palette instead of the previous near-black accent.
export const ACCENT = '#1F3A5F'

export const page: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflowY: 'auto',
  background: '#f4f6f9',
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
  borderBottom: '1px solid #d7dde5',
  // Higher than InkCanvas's floating Toolbar (zIndex 5). Neither the
  // canvas's relatively-positioned wrapper divs set their own zIndex, so
  // they don't form a stacking context — the Toolbar's zIndex competes
  // directly against this one at the page root, not scoped to the canvas.
  // Keep this above 5 (or give the canvas wrapper its own stacking
  // context) so a header dropdown, like the page-background menu, is
  // never covered by the canvas toolbar underneath it.
  zIndex: 20,
}

export const headerTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  flex: 1,
  // Explicit, not inherited: Chrome's auto-dark-mode forces unstyled text
  // to white, same issue as the folder/notebook/page title bug — anything
  // with visible text needs its own `color`, never relying on inheritance.
  color: '#1e1e2e',
}

export const iconCircleButton: CSSProperties = {
  border: 'none',
  background: '#e6eaf0',
  color: '#1e1e2e',
  borderRadius: '50%',
  width: 40,
  height: 40,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
}

export const badge: CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -2,
  background: '#dc2626',
  color: 'white',
  borderRadius: '50%',
  minWidth: 16,
  height: 16,
  fontSize: 10,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 3px',
}

export const floatingActions: CSSProperties = {
  position: 'fixed',
  right: 20,
  bottom: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 10,
  zIndex: 15,
}

export const pageCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 0,
  borderRadius: 12,
  background: 'white',
  color: '#1e1e2e',
  border: '1px solid #d7dde5',
  cursor: 'pointer',
  textAlign: 'left',
  overflow: 'hidden',
}

export const pageCardThumb: CSSProperties = {
  aspectRatio: '3 / 4',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#a8b3c2',
  borderBottom: '1px solid #e6eaf0',
}

export const pageCardBody: CSSProperties = {
  padding: '8px 10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

export const iconButton: CSSProperties = {
  border: 'none',
  background: '#e6eaf0',
  color: '#1e1e2e',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 16,
  cursor: 'pointer',
}

export const primaryButton: CSSProperties = {
  border: 'none',
  background: ACCENT,
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
  color: '#1e1e2e',
  border: '1px solid #d7dde5',
  cursor: 'pointer',
  textAlign: 'left',
}

/**
 * Style for a plain-looking <button> used only as a clickable title inside a
 * card (e.g. a notebook/page name). Buttons don't inherit text colour from
 * their container in every browser — on Android Chrome in dark mode an
 * unstyled button defaults to white text, which made card titles invisible
 * on a white card. Always set color explicitly here instead of relying on
 * inheritance.
 */
export const cardTitleButton: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1e1e2e',
  textAlign: 'left',
  padding: 0,
  cursor: 'pointer',
}

export const emptyState: CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: '#71717a',
}

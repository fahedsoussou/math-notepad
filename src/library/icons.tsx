// Small original line-icon set (own paths, not copied from any icon
// library or from Tratto) used to move the library chrome toward an
// icon-first toolbar, matching the look Fahed asked for.

interface IconProps {
  size?: number
}

export function FolderIcon({ color, size = 64 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 64 52" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10c0-2.2 1.8-4 4-4h14l4 5h30c2.2 0 4 1.8 4 4v3H4v-8z" fill={color} opacity={0.75} />
      <rect x="4" y="16" width="56" height="34" rx="4" fill={color} />
    </svg>
  )
}

export function SettingsIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="7" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TrashIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  )
}

export function PenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

export function HighlighterIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l2-5 9-9 4 4-9 9-5 2z" />
      <path d="M3 21l3-2" />
    </svg>
  )
}

export function EraserIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20H8l-5-5a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-8 8" />
      <path d="M13 20H6" />
    </svg>
  )
}

export function LassoIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4C6.5 4 3 7 3 10.5S6.5 16 10 16" strokeDasharray="3 3" />
      <circle cx="16" cy="18" r="3" />
      <path d="M13.5 15.5L11 17" />
    </svg>
  )
}

export function UndoIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7L3 11l4 4" />
      <path d="M3 11h11a6 6 0 0 1 0 12h-2" />
    </svg>
  )
}

export function RedoIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 7l4 4-4 4" />
      <path d="M21 11H10a6 6 0 0 0 0 12h2" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function OverflowIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

export function FountainPenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l5 5-5 15-5-15z" />
      <path d="M12 10v4" />
    </svg>
  )
}

export function BallpointPenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="14" rx="2" />
      <path d="M10 16l2 6 2-6z" />
    </svg>
  )
}

export function PencilIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v4l-3 15-3-15z" />
      <path d="M9 7h6" />
    </svg>
  )
}

export function CalligraphyPenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l5-5 4 4-5 5z" />
      <path d="M10 14L18 6l2 2-8 8" />
    </svg>
  )
}

export function MarkerPenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8l1 7H7z" />
      <path d="M7 9h10l-2 13H9z" />
    </svg>
  )
}

export function PageIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l3 3v17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M15 2v3h3" />
    </svg>
  )
}

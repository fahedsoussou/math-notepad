// Small fixed ink palette — a free color picker is unnecessary precision
// for a touch tablet and harder to tap accurately than a few big swatches.
export const PEN_COLORS = [
  '#1e1e2e', // near-black (default)
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // orange
  '#7c3aed', // violet
]

export const HIGHLIGHTER_COLORS = [
  '#fde047', // yellow (default)
  '#86efac', // green
  '#93c5fd', // blue
  '#fca5a5', // pink/red
]

export const PEN_SIZES = [2, 4, 8] as const
export const HIGHLIGHTER_SIZES = [14, 22] as const
export const HIGHLIGHTER_ALPHA = 0.4

export const ERASER_SCREEN_RADIUS = 16 // px, converted to page-space by caller

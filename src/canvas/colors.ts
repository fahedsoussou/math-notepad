import type { PenType } from '../storage/db'

export const PEN_TYPES: PenType[] = ['fountain', 'ballpoint', 'pencil', 'calligraphy', 'marker']

export const PEN_TYPE_LABELS: Record<PenType, string> = {
  fountain: 'Fountain pen',
  ballpoint: 'Ballpoint',
  pencil: 'Pencil',
  calligraphy: 'Calligraphy',
  marker: 'Marker',
}

/** perfect-freehand tuning + opacity per pen type. `taper`/`cap` shape the
 * stroke's own start/end — a real fountain pen fades to a fine point, but a
 * ballpoint/marker/calligraphy nib stops abruptly at its full width, so
 * `taper: false` there is what actually sells the difference, more than
 * `thinning` alone. `fountain`'s thinning/smoothing/streamline match the
 * app's original (only) pen feel, so old strokes with no stored `penType`
 * look identical to before. */
export const PEN_TYPE_OPTIONS: Record<
  PenType,
  { thinning: number; smoothing: number; streamline: number; alpha: number; taper: boolean }
> = {
  fountain: { thinning: 0.65, smoothing: 0.55, streamline: 0.5, alpha: 1, taper: true },
  ballpoint: { thinning: 0.12, smoothing: 0.2, streamline: 0.35, alpha: 1, taper: false },
  pencil: { thinning: 0.55, smoothing: 0.4, streamline: 0.4, alpha: 0.6, taper: true },
  calligraphy: { thinning: 0.65, smoothing: 0.3, streamline: 0.5, alpha: 1, taper: false },
  marker: { thinning: 0.05, smoothing: 0.25, streamline: 0.3, alpha: 0.78, taper: false },
}

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

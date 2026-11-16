import { useLiveQuery } from 'dexie-react-hooks'

/**
 * Wraps a Dexie `.get(id)`-style lookup so "still loading" and "not found"
 * are distinguishable. Both `useLiveQuery(() => table.get(id))` returning
 * `undefined` look identical otherwise, which made a brand-new, perfectly
 * real folder/notebook/page flash a "this was deleted" message for a frame
 * while IndexedDB was still answering the first query.
 *
 * Returns `undefined` while loading, `null` once confirmed missing/deleted,
 * or the record once loaded.
 */
export function useEntity<T>(getter: () => Promise<T | undefined>, deps: unknown[]): T | null | undefined {
  return useLiveQuery(() => getter().then((r) => r ?? null), deps)
}

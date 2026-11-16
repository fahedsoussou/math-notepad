/**
 * Ask the browser not to evict our IndexedDB data under storage pressure.
 * Best-effort: some browsers auto-grant it, some show no prompt at all, and
 * it can simply be refused. None of that should block the app.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

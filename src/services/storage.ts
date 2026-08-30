const STORAGE_VERSION = 1

type VersionedValue<T> = {
  version: number
  value: T
}

function getStorage(kind: 'session' | 'local'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

export function readVersioned<T>(key: string, kind: 'session' | 'local' = 'session', allowLegacyRaw = false): T | null {
  const storage = getStorage(kind)
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'version' in parsed && 'value' in parsed) {
      const envelope = parsed as Partial<VersionedValue<T>>
      return envelope.version === STORAGE_VERSION ? envelope.value ?? null : null
    }
    // Read the pre-migration JSON format once and upgrade it in place.
    writeVersioned(key, parsed as T, kind)
    return parsed as T
  } catch {
    // The trip input used to be stored as an unquoted string. Preserve it so
    // an old session can still finish the current flow, then upgrade it.
    if (!allowLegacyRaw) return null
    writeVersioned(key, raw as T, kind)
    return raw as T
  }
}

export function writeVersioned<T>(key: string, value: T, kind: 'session' | 'local' = 'session') {
  const storage = getStorage(kind)
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, value } satisfies VersionedValue<T>))
  } catch {
    // Storage can be unavailable in private browsing or after quota errors.
  }
}

export function removeStored(key: string, kind: 'session' | 'local' = 'session') {
  const storage = getStorage(kind)
  try { storage?.removeItem(key) } catch { /* ignore unavailable storage */ }
}

export { STORAGE_VERSION }

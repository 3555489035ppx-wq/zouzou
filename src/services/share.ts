function configuredShareOrigin() {
  const value = (import.meta.env.VITE_PUBLIC_APP_ORIGIN ?? '').trim()
  if (!value) return null
  try { return new URL(value).origin } catch { return null }
}

export function getShareUrl(path: string) {
  const origin = configuredShareOrigin() ?? window.location.origin
  return new URL(path, `${origin}/`).toString()
}

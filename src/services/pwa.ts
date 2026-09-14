export type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let installPrompt: InstallPrompt | null = null
let waitingWorker: ServiceWorker | null = null
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
export const pendingInstall = () => installPrompt
export const pendingUpdate = () => waitingWorker
const notify = () => window.dispatchEvent(new Event('zouzou:pwa'))

export function initializePwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    installPrompt = event as InstallPrompt
    notify()
  })
  window.addEventListener('appinstalled', () => { installPrompt = null; notify() })
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const inspect = () => { waitingWorker = registration.waiting; notify() }
    inspect()
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', inspect))
    window.addEventListener('focus', () => { void registration.update().catch(() => undefined) })
  }).catch(() => { /* Installation remains possible where service workers are unavailable. */ })
}

export async function requestInstall() {
  if (!installPrompt) return 'unavailable'
  const event = installPrompt
  installPrompt = null
  await event.prompt()
  const choice = await event.userChoice
  notify()
  return choice.outcome
}

export function activateUpdate() {
  // Keep the current document and input alive; new pages use the new worker.
  waitingWorker?.postMessage({ type: 'ACTIVATE_UPDATE' })
  waitingWorker = null
  notify()
}

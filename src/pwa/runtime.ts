const PWA_BUILD_VERSION_KEY = 'amk_pwa_build_version'
const APP_BUILD_VERSION = typeof __APP_BUILD_VERSION__ === 'string' && __APP_BUILD_VERSION__.trim()
  ? __APP_BUILD_VERSION__
  : '0.0.1'

async function unregisterServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.allSettled(registrations.map((registration) => registration.unregister()))
}

async function clearCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return
  const keys = await caches.keys()
  await Promise.allSettled(keys.map((key) => caches.delete(key)))
}

export async function clearPwaRuntimeData() {
  try {
    await unregisterServiceWorkers()
    await clearCaches()
  } catch {
    // ignore cleanup failures
  }
}

export async function syncPwaRuntimeForCurrentBuild() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return

  try {
    const previousVersion = localStorage.getItem(PWA_BUILD_VERSION_KEY)
    if (previousVersion === APP_BUILD_VERSION) return

    await clearPwaRuntimeData()
    localStorage.setItem(PWA_BUILD_VERSION_KEY, APP_BUILD_VERSION)
  } catch {
    // ignore version sync failures
  }
}

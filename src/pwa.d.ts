declare module 'virtual:pwa-register' {
  export function registerSW(options?: unknown): (reloadPage?: boolean) => Promise<void>
}


declare const __APP_BUILD_VERSION__: string

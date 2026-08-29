/// <reference types="vite/client" />

declare global {
  interface Window {
    AMap?: unknown
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

export {}

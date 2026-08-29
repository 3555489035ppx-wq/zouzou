export interface AuthAdapter {
  signInWithPhone(phone: string, code: string): Promise<{ userId: string }>
}

export interface DatabaseAdapter {
  saveTrip<T>(tripId: string, value: T): Promise<void>
  loadTrip<T>(tripId: string): Promise<T | null>
}

export interface AnalyticsAdapter {
  track(event: string, properties?: Record<string, string | number | boolean>): void
}

export interface StorageAdapter {
  saveAsset(file: File): Promise<{ url: string }>
}

class LocalAuthAdapter implements AuthAdapter {
  async signInWithPhone(phone: string, code: string) {
    if (!phone || code.length !== 6) throw new Error('手机号或验证码不完整')
    return { userId: 'demo-user' }
  }
}

class LocalDatabaseAdapter implements DatabaseAdapter {
  async saveTrip<T>(tripId: string, value: T) { localStorage.setItem(`zouzou-trip:${tripId}`, JSON.stringify(value)) }
  async loadTrip<T>(tripId: string) {
    const value = localStorage.getItem(`zouzou-trip:${tripId}`)
    return value ? JSON.parse(value) as T : null
  }
}

class LocalAnalyticsAdapter implements AnalyticsAdapter {
  track(event: string, properties: Record<string, string | number | boolean> = {}) {
    if (import.meta.env.DEV) console.info('[ZOUZOU demo event]', event, properties)
  }
}

class LocalStorageAdapter implements StorageAdapter {
  async saveAsset(file: File) { return { url: URL.createObjectURL(file) } }
}

export const platformServices = {
  auth: new LocalAuthAdapter(),
  database: new LocalDatabaseAdapter(),
  analytics: new LocalAnalyticsAdapter(),
  storage: new LocalStorageAdapter(),
}

/**
 * Auth boundary for the local demo. The interface mirrors the provider
 * boundary used by mature auth modules such as Better Auth; the current
 * implementation deliberately stays local and deterministic so the demo does
 * not send credentials anywhere.
 */
export type AuthProvider = 'phone' | 'wechat' | 'apple'

export type AuthUser = {
  id: string
  phone?: string
  provider: AuthProvider
  nickname: string
}

export interface AuthAdapter {
  requestCode(phone: string): Promise<void>
  signInWithCode(phone: string, code: string): Promise<AuthUser>
  signInWithProvider(provider: Exclude<AuthProvider, 'phone'>): Promise<AuthUser>
}

const demoUser = (provider: AuthProvider, phone?: string): AuthUser => ({
  id: 'local-demo-user',
  phone,
  provider,
  nickname: '小鹏',
})

export const localAuthAdapter: AuthAdapter = {
  async requestCode() {
    await new Promise((resolve) => window.setTimeout(resolve, 260))
  },
  async signInWithCode(phone, code) {
    if (code.trim().length < 4) throw new Error('验证码至少需要 4 位')
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    return demoUser('phone', phone)
  },
  async signInWithProvider(provider) {
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    return demoUser(provider)
  },
}


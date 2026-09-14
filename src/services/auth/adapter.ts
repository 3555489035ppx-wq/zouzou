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

export const localAuthAdapter: AuthAdapter = {
  async requestCode() { throw new Error('手机号登录尚未配置短信服务；没有发送验证码。你可以使用仅此设备的访客模式。') },
  async signInWithCode() { throw new Error('尚未配置短信验证服务，不能验证登录。') },
  async signInWithProvider(provider) { throw new Error((provider === 'wechat' ? '微信' : 'Apple') + '登录尚未配置授权凭证；你可以使用访客模式。') },
}

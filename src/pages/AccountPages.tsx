import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, Upload } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ZouButton, ZouMotionBot, ZouNavigationBar } from '../components/ui'
import { ZouLogo } from '../components/ZouLogo'
import { useAppStore } from '../stores/appStore'
import { localAuthAdapter } from '../services/auth/adapter'

export const SplashPage = () => {
  const navigate = useNavigate()
  useEffect(() => { const id = window.setTimeout(() => navigate('/login'), 1300); return () => window.clearTimeout(id) }, [navigate])
  return <AppShell><section className="splash"><ZouLogo className="splash__logo" walking /><div className="splash__wordmark">走走</div><button className="sr-only" onClick={() => navigate('/login')}>跳过启动页</button></section></AppShell>
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<'methods' | 'phone' | 'code'>('methods')
  const [phone, setPhone] = useState('138 0013 8000')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const providerIcon = (provider: 'wechat' | 'apple') => <img className="provider-icon" src={`/assets/simple-icons/${provider}.svg`} alt="" aria-hidden="true" />
  const continueWithProvider = async (provider: 'wechat' | 'apple') => {
    setError('')
    await localAuthAdapter.signInWithProvider(provider)
    navigate('/onboarding')
  }
  return <AppShell><div className="account-page">
    {step !== 'methods' ? <ZouNavigationBar title={step === 'phone' ? '手机号登录' : '输入验证码'} back={false} right={<button className="text-button" onClick={() => setStep(step === 'code' ? 'phone' : 'methods')}>返回</button>} /> : null}
    <div className="account-hero"><ZouMotionBot state={step === 'code' ? 'listening' : 'idle'} size="sm" /><h1>{step === 'methods' ? '欢迎来到走走' : step === 'phone' ? '你的手机号' : '确认是你'}</h1><p>{step === 'methods' ? '从一个模糊想法，走到一次真实旅程。' : step === 'phone' ? '我们会发送 6 位验证码。' : `验证码已发送至 ${phone}`}</p></div>
    {step === 'methods' ? <div className="login-methods"><ZouButton onClick={() => setStep('phone')}><Smartphone />手机号登录</ZouButton><ZouButton variant="secondary" onClick={() => void continueWithProvider('wechat')}>{providerIcon('wechat')}微信登录</ZouButton><ZouButton variant="secondary" onClick={() => void continueWithProvider('apple')}>{providerIcon('apple')}通过 Apple 登录</ZouButton></div> : null}
    {step === 'phone' ? <form onSubmit={async (event) => { event.preventDefault(); setError(''); try { await localAuthAdapter.requestCode(phone); setStep('code') } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法发送验证码') } }} className="form-stack"><label>手机号<input autoFocus inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label><ZouButton type="submit">获取验证码</ZouButton></form> : null}
    {step === 'code' ? <form onSubmit={async (event) => { event.preventDefault(); setError(''); try { await localAuthAdapter.signInWithCode(phone, code); navigate('/onboarding') } catch (cause) { setError(cause instanceof Error ? cause.message : '验证码不正确') } }} className="form-stack"><label>6 位验证码<input autoFocus inputMode="numeric" maxLength={6} value={code} placeholder="000000" onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label><ZouButton type="submit" disabled={code.length < 4}>验证并继续</ZouButton><button type="button" className="text-button" onClick={() => void localAuthAdapter.requestCode(phone)}>重新发送</button></form> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </div></AppShell>
}

export const OnboardingPage = () => {
  const navigate = useNavigate()
  const setProfile = useAppStore((s) => s.setProfile)
  const existingAvatar = useAppStore((s) => s.avatar)
  const [avatar, setAvatar] = useState(existingAvatar)
  const [nickname, setNickname] = useState('小鹏')
  return <AppShell><div className="account-page"><ZouNavigationBar title="创建个人资料" /><div className="onboarding"><h1>让朋友认出你</h1><p>第一次只需要头像和昵称，其他偏好会在使用中慢慢学习。</p><label className="avatar-upload"><img src={avatar} alt="当前头像" /><span><Upload />更换头像</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAvatar(URL.createObjectURL(file)) }} /></label><label>昵称<input value={nickname} onChange={(e) => setNickname(e.target.value)} /></label><ZouButton onClick={() => { setProfile(nickname || '小鹏', avatar); navigate('/home') }}>进入走走</ZouButton></div></div></AppShell>
}

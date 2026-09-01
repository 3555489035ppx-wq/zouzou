import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, Upload } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ZouButton, ZouMotionBot, ZouNavigationBar } from '../components/ui'
import { useAppStore } from '../stores/appStore'
import { localAuthAdapter } from '../services/auth/adapter'
import { track } from '../services/analytics'

export const SplashPage = () => {
  const navigate = useNavigate()
  useEffect(() => { const id = window.setTimeout(() => navigate('/login'), 2000); return () => window.clearTimeout(id) }, [navigate])
  return <AppShell><section className="splash"><img className="splash__logo" src="/assets/brand/zouzou-walker.png" alt="" width="250" height="305" /><div className="splash__wordmark">走走</div><button className="sr-only" onClick={() => navigate('/login')}>跳过启动页</button></section></AppShell>
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
  const setTripMode = useAppStore((s) => s.setTripMode)
  const setOnboardingCompleted = useAppStore((s) => s.setOnboardingCompleted)
  const existingAvatar = useAppStore((s) => s.avatar)
  const [step, setStep] = useState(1)
  const [avatar, setAvatar] = useState(existingAvatar)
  const [nickname, setNickname] = useState('小鹏')
  const finish = (skipped = false) => {
    setProfile(nickname || '小鹏', avatar)
    setTripMode('none')
    setOnboardingCompleted(true)
    track('onboarding_complete', { step, skipped })
    navigate('/home')
  }
  const next = () => {
    setProfile(nickname || '小鹏', avatar)
    setStep((value) => Math.min(5, value + 1))
  }
  const stepCopy = [
    ['个人资料', '让朋友认出你'],
    ['AI 旅行', '想去哪，说一句就行'],
    ['Journey + 地图', '路线、地点、每天安排一次生成'],
    ['地点资料', '旅途中需要的信息都在这里'],
    ['行程工具', '记账、行李、足迹也一起记住'],
  ] as const
  return <AppShell><div className="account-page"><ZouNavigationBar title={step === 1 ? '创建个人资料' : '认识走走'} right={step > 1 ? <button className="text-button" onClick={() => finish(true)}>跳过</button> : null} /><div className="onboarding"><div className="onboarding-progress" role="status" aria-label={`引导第 ${step} 步，共 5 步`}>{stepCopy.map(([label], index) => <span key={label} className={index + 1 <= step ? 'is-active' : ''}>{index + 1}<small>{label}</small></span>)}</div>{step === 1 ? <><h1>让朋友认出你</h1><p>第一次只需要头像和昵称，其他偏好会在使用中慢慢学习。</p><label className="avatar-upload"><img src={avatar} alt="当前头像" /><span><Upload />更换头像</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAvatar(URL.createObjectURL(file)) }} /></label><label>昵称<input name="nickname" autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} /></label><div className="onboarding-actions"><ZouButton onClick={next}>继续了解</ZouButton><ZouButton variant="secondary" onClick={() => finish(true)}>进入走走</ZouButton></div></> : <><ZouMotionBot state={step === 2 ? 'listening' : step === 3 ? 'walking' : step === 4 ? 'done' : 'completed'} size="sm" label="Bloub / Grok Bot" /><span className="onboarding-eyebrow">{stepCopy[step - 1][0]}</span><h1>{stepCopy[step - 1][1]}</h1><p>{step === 2 ? '不用先想清楚目的地、预算和所有细节，把脑海里的那句话交给走走。' : step === 3 ? '走走会把自然语言整理成可执行的多日路线，并把每天的移动放到地图上。' : step === 4 ? '打开一个地点，就能看到停留、消费、开放时间和出发前需要核对的提醒。' : '路线之外，还有费用、出发清单、足迹和一张随时可以带走的分享卡。'}</p><ul className="onboarding-points">{(step === 2 ? ['模糊想法也可以开始', '先理解，再让你确认'] : step === 3 ? ['按天查看，不把路线混在一起', '地图和时间轴保持同一份计划'] : step === 4 ? ['从当天地点快速打开资料', '资料页可以直接记账、加清单、留足迹'] : ['数据按这次 Journey 保存', '完成后还能回到足迹里重温']).map((item) => <li key={item}>{item}</li>)}</ul><div className="onboarding-actions">{step > 1 ? <button className="text-button" onClick={() => setStep((value) => Math.max(1, value - 1))}>上一步</button> : null}{step < 5 ? <ZouButton onClick={next}>继续了解</ZouButton> : <ZouButton onClick={() => finish(false)}>开始走走</ZouButton>}</div></>}</div></div></AppShell>
}

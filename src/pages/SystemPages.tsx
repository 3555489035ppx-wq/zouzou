import { useEffect, useRef, useState } from 'react'
import { BatteryMedium, Signal, Wifi } from 'lucide-react'
import { ZouMotionBot } from '../components/ui'
import type { BotState } from '../character/engine/motionEngine'

export const PresentationPage = () => {
  const [splashVisible, setSplashVisible] = useState(true)
  const [embeddedPath, setEmbeddedPath] = useState('/login')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    // Keep the brand frame visible for roughly two seconds before handing
    // control to the first-user login flow.
    const timer = window.setTimeout(() => setSplashVisible(false), 2000)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object' || data.type !== 'zouzou-route' || typeof data.pathname !== 'string') return
      setEmbeddedPath(data.pathname)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  const lightStatus = embeddedPath.startsWith('/profile')
  return (
    <main className="presentation-stage">
      <section className="iphone-shell" aria-label="iPhone 17 Pro 展示模式">
        <div className="iphone-screen">
          <div className={`ios-status ${lightStatus ? 'ios-status--light' : ''}`}><b>9:41</b><span className="dynamic-island" /><span className="ios-signals" aria-hidden="true"><Signal /><Wifi /><BatteryMedium /></span></div>
          {/* V7 的首次用户路径从品牌首屏进入登录，而不是把已有 Demo 状态直接
              塞进首页。登录完成后 iframe 内的 Router 会继续走资料引导和首页。 */}
          <iframe ref={iframeRef} title="走走应用" src="/login?embedded=1" className={splashVisible ? 'is-splashing' : ''} />
          {splashVisible ? <div className="presentation-splash" role="status" aria-label="正在进入走走">
            <img className="presentation-splash__logo" src="/assets/brand/zouzou-walker.png" alt="" width="250" height="305" />
            <strong>走走</strong>
          </div> : null}
          <span className="home-indicator" />
        </div>
      </section>
    </main>
  )
}

const botStates: BotState[]=['idle','listening','reading','thinking','planning','done','walking','arriving','alert','error']
export const BotLabPage=()=>{const[state,setState]=useState<BotState>('idle');return <main className="bot-lab"><header><span>ZOU BOT ENGINE</span><h1>同一个生命体，不同的旅途状态。</h1><p>纯时间采样 · 可中断过渡 · AI 与行程共用</p></header><section className="bot-lab__stage"><ZouMotionBot state={state}/><strong>{state}</strong></section><nav>{botStates.map(item=><button key={item} aria-pressed={state===item} onClick={()=>setState(item)}>{item}</button>)}</nav></main>}

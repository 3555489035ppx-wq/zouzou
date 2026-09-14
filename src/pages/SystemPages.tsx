import { useEffect, useRef, useState } from 'react'
import { BatteryMedium, Signal, Wifi } from 'lucide-react'
import { ZouMotionBot } from '../components/ui'
import type { BotState } from '../character/engine/motionEngine'

export const PresentationPage = () => {
  const [embeddedPath, setEmbeddedPath] = useState('/splash')
  const iframeRef = useRef<HTMLIFrameElement>(null)
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
          <iframe ref={iframeRef} title="走走应用" src="/splash?embedded=1" />
          <span className="home-indicator" />
        </div>
      </section>
    </main>
  )
}

const botStates: BotState[]=['idle','listening','reading','thinking','planning','done','walking','arriving','happy','focused','surprised','waiting','sleepy','warning','sad','error']
export const BotLabPage=()=>{const[state,setState]=useState<BotState>('idle');return <main className="bot-lab"><header><span>ZOU BOT ENGINE</span><h1>同一个生命体，不同的旅途状态。</h1><p>纯时间采样 · 可中断过渡 · AI 与行程共用</p></header><section className="bot-lab__stage"><ZouMotionBot state={state}/><strong>{state}</strong></section><nav>{botStates.map(item=><button key={item} aria-pressed={state===item} onClick={()=>setState(item)}>{item}</button>)}</nav></main>}

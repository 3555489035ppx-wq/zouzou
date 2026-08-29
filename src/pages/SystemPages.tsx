import { useEffect, useState } from 'react'
import { BatteryMedium, Signal, Wifi } from 'lucide-react'
import { ZouLogo } from '../components/ZouLogo'
import { ZouMotionBot } from '../components/ui'
import type { BotState } from '../character/engine/motionEngine'

export const PresentationPage = () => {
  const [splashVisible, setSplashVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setSplashVisible(false), 2000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <main className="presentation-stage">
      <section className="iphone-shell" aria-label="iPhone 17 Pro 展示模式">
        <div className="iphone-screen">
          <div className="ios-status"><b>9:41</b><span className="dynamic-island" /><span className="ios-signals" aria-hidden="true"><Signal /><Wifi /><BatteryMedium /></span></div>
          <iframe title="走走应用" src="/home?embedded=1" className={splashVisible ? 'is-splashing' : ''} />
          {splashVisible ? <div className="presentation-splash" role="status" aria-label="正在进入走走">
            <ZouLogo className="presentation-splash__logo" walking />
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

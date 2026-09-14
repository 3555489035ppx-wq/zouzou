import { startTransition, useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { StartupBot } from './StartupBot'
import { HomePage } from '../pages/HomePage'
import { STARTUP_DURATION_MS, STARTUP_HOME_PREPARE_MS } from '../character/startupMotion'

const sessionKey = 'zouzou-intro-seen'
export function StartupExperience() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const replay = params.get('replay') === '1'
  const systemReduced = useReducedMotion()
  const reduced = useAppStore(state => state.reducedMotion) || systemReduced
  const [visible, setVisible] = useState(() => {
    if (pathname === '/home') return false
    try { return replay || sessionStorage.getItem(sessionKey) !== '1' } catch { return true }
  })
  const [homeReady, setHomeReady] = useState(!visible)
  useEffect(() => {
    if (!visible || reduced) {
      if (reduced && visible) setVisible(false)
      try { sessionStorage.setItem(sessionKey, '1') } catch { /* storage is optional */ }
      if (pathname !== '/home') startTransition(() => navigate('/home', { replace: true }))
      return
    }
    // Prepare the home view during the quiet hold, after the entrance. It stays
    // mounted across /splash → /home, so the final dissolve has no second mount.
    const prepare = window.setTimeout(() => setHomeReady(true), STARTUP_HOME_PREPARE_MS)
    return () => clearTimeout(prepare)
  }, [visible, reduced, navigate, pathname])
  return <div className="startup-experience">
    <div inert={visible && !reduced ? true : undefined} aria-hidden={visible && !reduced ? true : undefined}>{homeReady || !visible || reduced ? <HomePage /> : null}</div>
    {visible && !reduced ? <section className="startup-intro" style={{ '--intro-duration': `${STARTUP_DURATION_MS}ms` } as CSSProperties} aria-label="走走启动动画" onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === 'startup-reveal-home') setVisible(false)
    }}>
      <div className="startup-intro__center">
        <div className="startup-intro__window"><div className="startup-intro__bot"><StartupBot /></div></div>
        <span className="startup-intro__ground" aria-hidden="true" />
        <div className="startup-intro__copy"><h1>走走</h1><p>这次，想去哪儿？</p></div>
      </div>
    </section> : null}
  </div>
}

export function StartupPreviewPage() {
  const [run, setRun] = useState(0)
  return <main className="startup-review">
    <section className="startup-review__brief"><h1>从一句招呼，<br />开始走走。</h1><p>保留原来的 Bot。用黑、白与不同深浅的灰，让动作和表情成为开场的主角。</p>
      <ol><li><strong>0—1.1 秒 · 轻轻探头</strong><span>原来的 Bot 一次自然抬起，目光慢慢看向你。</span></li><li><strong>1.1—1.65 秒 · 看见你</strong><span>目光柔和舒展，饱满圆润的“走走”与问候依次出现。</span></li><li><strong>1.65—2.8 秒 · 打个招呼</strong><span>短短眨眼打招呼，2.1 秒回到自然状态，稍作停留就进入首页。</span></li><li><strong>2.8—3.4 秒 · 自然进入</strong><span>开场柔和淡出，连续进入已准备好的首页。</span></li></ol>
      <p className="startup-review__note">界面保持黑白灰，旅行照片保留原色。每个会话播放一次；减少动态效果时直接进入。再次点击重播可看完整 3.4 秒过程。</p>
    </section>
    <section className="startup-review__stage" aria-label="启动演示">
      <button className="startup-review__replay" onClick={() => setRun(value => value + 1)}>重播完整开场</button>
      <iframe key={run} className="startup-review__phone" title="走走启动到首页交互预览" src="/splash?replay=1" />
    </section>
  </main>
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ZouTabBar } from './ui'
import { useAppStore } from '../stores/appStore'
import { useLocation, useSearchParams } from 'react-router-dom'
import { GroupTripSync } from './GroupTripSync'

export const AppShell = ({ children, showTabBar = false, immersive = false, restoreScroll = true }: { children: ReactNode; showTabBar?: boolean; immersive?: boolean; restoreScroll?: boolean }) => {
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const location = useLocation()
  const scrollParams = new URLSearchParams(location.search)
  if (location.pathname === '/discover') scrollParams.delete('page')
  const scrollKey = `zouzou-scroll:${location.pathname}?${scrollParams}`
  const shellRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [searchParams] = useSearchParams()
  // Presentation mode is an iframe. Relying only on the query flag meant a
  // tab click (which navigates to a clean route) dropped the safe-area inset
  // and put Community/Profile headers back underneath the mock status bar.
  const embedded = searchParams.get('embedded') === '1' || (typeof window !== 'undefined' && window.parent !== window)
  useEffect(() => {
    const key = scrollKey
    let restored = { shell: 0, page: 0, window: 0 }
    try { if (restoreScroll) restored = JSON.parse(sessionStorage.getItem(key) ?? 'null') ?? restored } catch { /* unavailable session storage */ }
    const frame = requestAnimationFrame(() => { shellRef.current?.scrollTo({ top: restored.shell, behavior: 'auto' }); pageRef.current?.scrollTo({ top: restored.page, behavior: 'auto' }); window.scrollTo(0, restored.window) })
    const save = () => { if(!shellRef.current || !pageRef.current)return;try { sessionStorage.setItem(key, JSON.stringify({ shell: shellRef.current.scrollTop, page: pageRef.current.scrollTop, window: window.scrollY })) } catch { /* route content remains usable */ } }
    let scrollFrame=0
    const onScroll=()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;save()})}
    const shell=shellRef.current,page=pageRef.current
    shell?.addEventListener('scroll',onScroll,{passive:true});page?.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('scroll',onScroll,{passive:true})
    window.addEventListener('pagehide', save)
    const onVisibility = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);save();shell?.removeEventListener('scroll',onScroll);page?.removeEventListener('scroll',onScroll);window.removeEventListener('scroll',onScroll);window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', onVisibility) }
  }, [scrollKey, restoreScroll])
  useEffect(()=>{
    const viewport=window.visualViewport
    const update=()=>{
      const editing=document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
      const inset=editing&&viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0
      shellRef.current?.style.setProperty('--keyboard-inset',`${inset}px`)
      if(shellRef.current)shellRef.current.dataset.keyboardOpen=String(inset>100)
    }
    viewport?.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update)
    return()=>{viewport?.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update)}
  },[])
  useEffect(() => {
    if (embedded && window.parent !== window) window.parent.postMessage({ type: 'zouzou-route', pathname: location.pathname }, window.location.origin)
  }, [embedded, location.pathname])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return (
    <main ref={shellRef} className={`app-shell ${showTabBar ? 'has-tabbar' : ''} ${immersive ? 'is-immersive' : ''} ${embedded ? 'is-embedded' : ''}`}>
      <GroupTripSync key={location.pathname} />
      {!online ? <div className="offline-banner" role="status">当前离线，已保存内容仍可查看</div> : null}
      <motion.div ref={pageRef} className="app-page" initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </motion.div>
      {showTabBar ? <ZouTabBar /> : null}
    </main>
  )
}

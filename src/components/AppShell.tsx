import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ZouTabBar } from './ui'
import { useAppStore } from '../stores/appStore'
import { useLocation, useSearchParams } from 'react-router-dom'

export const AppShell = ({ children, showTabBar = false, immersive = false }: { children: ReactNode; showTabBar?: boolean; immersive?: boolean }) => {
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const location = useLocation()
  const shellRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  // Presentation mode is an iframe. Relying only on the query flag meant a
  // tab click (which navigates to a clean route) dropped the safe-area inset
  // and put Community/Profile headers back underneath the mock status bar.
  const embedded = searchParams.get('embedded') === '1' || (typeof window !== 'undefined' && window.parent !== window)
  useEffect(() => {
    shellRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    pageRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])
  useEffect(() => {
    if (embedded && window.parent !== window) window.parent.postMessage({ type: 'zouzou-route', pathname: location.pathname }, window.location.origin)
  }, [embedded, location.pathname])
  return (
    <main ref={shellRef} className={`app-shell ${showTabBar ? 'has-tabbar' : ''} ${immersive ? 'is-immersive' : ''} ${embedded ? 'is-embedded' : ''}`}>
      <motion.div ref={pageRef} className="app-page" initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 0.26, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </motion.div>
      {showTabBar ? <ZouTabBar /> : null}
    </main>
  )
}

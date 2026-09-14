import { useEffect, useState } from 'react'
import { activateUpdate, pendingUpdate } from '../services/pwa'

export function AppUpdateNotice() {
  const [available, setAvailable] = useState(Boolean(pendingUpdate()))
  const [activated, setActivated] = useState(false)
  useEffect(() => {
    const update = () => setAvailable(Boolean(pendingUpdate()))
    window.addEventListener('zouzou:pwa', update)
    return () => window.removeEventListener('zouzou:pwa', update)
  }, [])
  if (!available && !activated) return null
  return <aside className="app-update-notice" role="status">
    {activated ? <p>新版已准备好。请先保存当前内容，下次重新打开时使用新版。</p> : <><p>有新版本，当前输入会保持不变。</p><button type="button" onClick={() => { activateUpdate(); setActivated(true) }}>准备更新</button></>}
    <button type="button" onClick={() => { setAvailable(false); setActivated(false) }}>稍后</button>
  </aside>
}

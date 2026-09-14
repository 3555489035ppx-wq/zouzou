import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { ZouNavigationBar } from '../components/ui'
import { isStandalone, pendingInstall, requestInstall } from '../services/pwa'

export default function InstallPage() {
  const [, refresh] = useState(0)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const update = () => refresh(value => value + 1)
    window.addEventListener('zouzou:pwa', update)
    return () => window.removeEventListener('zouzou:pwa', update)
  }, [])
  const embeddedBrowser = /MicroMessenger|QQ\//i.test(navigator.userAgent)
  return <AppShell><ZouNavigationBar title="添加到手机桌面" /><main className="page-content">
    <img src="/assets/pwa/icon-192.png" alt="走走图标" width={80} height={80} />
    <h1>从手机桌面打开走走</h1>
    {isStandalone() ? <p role="status">你正在独立的走走窗口中使用。</p> : <>
      {embeddedBrowser ? <p>请先使用右上角菜单，在 Safari 或系统浏览器中打开本页。</p> : null}
      <h2>iPhone</h2><ol><li>在 Safari 打开走走。</li><li>点击分享，选择“添加到主屏幕”。</li><li>若出现“作为网页 App 打开”，请开启。</li><li>确认名称为“走走”，点击添加。</li></ol>
      <h2>Android</h2><p>在 Chrome 等浏览器菜单中选择“安装应用”或“添加到主屏幕”。具体名称以浏览器显示为准。</p>
      {pendingInstall() ? <button type="button" onClick={async () => {
        try { const result = await requestInstall(); setMessage(result === 'accepted' ? '已提交安装请求，请按浏览器提示完成。' : result === 'dismissed' ? '已取消，可以稍后再添加。' : '请从浏览器菜单添加。') }
        catch { setMessage('请从浏览器菜单添加到桌面。') }
      }}>安装走走</button> : null}
    </>}
    <p>浏览器和桌面窗口可能使用不同的访客身份。请在常用窗口保存行程；未登录访客不能保证跨设备找回私人行程。</p>
    <p role="status">{message}</p>
  </main></AppShell>
}

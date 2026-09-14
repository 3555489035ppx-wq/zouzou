import { useState } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ZouBottomSheet, ZouNavigationBar, ZouSegmentedControl } from '../components/ui'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { requestCurrentLocation, type LocationStatus } from '../services/location'

export const NotificationsPage = () => {
  const [tab, setTab] = useState('行程')
  const navigate=useNavigate()
  const items = tab==='系统' ? [{icon:Settings,title:'减少动态效果',body:'在设置中调整此设备的动态效果'}] : []
  return <AppShell><ZouNavigationBar title="通知" /><div className="page-content"><ZouSegmentedControl options={['行程', '社区', '系统']} value={tab} onChange={setTab} />{items.length===0?<p>暂无通知。当前没有公共社区或推送服务的新消息。</p>:null}<div className="notification-list">{items.map(({ icon: Icon, title, body }) => <button key={title} onClick={()=>navigate('/settings')}><span><Icon /></span><div><strong>{title}</strong><small>{body}</small></div><ChevronRight /></button>)}</div></div></AppShell>
}

export const SettingsPage = () => {
  const navigate = useNavigate()
  const [confirmErase,setConfirmErase]=useState(false)
  const [dataMessage,setDataMessage]=useState('')
  const exportLocalData=()=>{
    try{const data=Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('zouzou')).map(key=>[key,localStorage.getItem(key)]));const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),scope:'仅此设备',data},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='走走-本机数据备份.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDataMessage('已创建本机数据备份文件。') }catch{setDataMessage('导出失败，原数据未删除。')}
  }
  const eraseLocalData=async()=>{
    try{const response=await fetch('/api/session/logout',{method:'POST'});if(!response.ok)throw Error();for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage).filter(key=>key.startsWith('zouzou')))storage.removeItem(key);window.location.assign('/login')}catch{setDataMessage('清理未完成，请重试。服务器分享快照需要先逐项撤销。')}
  }
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const communityMapVisible = useAppStore((s) => s.communityMapVisible)
  const setCommunityMapVisible = useAppStore((s) => s.setCommunityMapVisible)
  const [info, setInfo] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const settingCopy: Record<string, string> = {
    '账号与安全': '当前可使用设备访客会话；手机号、微信和Apple登录尚未配置。此设备的旅行保存在浏览器，分享与多人计划由本地服务保存。',
    '隐私': '旅行文本和主动提交的截图可发送给当前配置的理解服务。本机数据可导出或删除。服务端分享在7天后失效，也可从创建页撤销；清理本机不等于删除服务端数据。',
    '通知': '通知设置会在正式账号服务接入后同步到设备，本地预览暂不发送推送。',
    '关于走走': '走走是一个把城市路线整理成可执行行程的体验原型。路线和第三方价格仍需出行前核对。',
  }
  const openSetting = async (item: string) => {
    if (item === '添加到手机桌面') { navigate('/settings/install'); return }
    if (item !== '定位权限') {
      setInfo(settingCopy[item] ?? '')
      return
    }
    setLocationStatus('requesting')
    setInfo('正在请求定位权限…')
    try {
      await requestCurrentLocation()
      setLocationStatus('granted')
      setInfo('定位已授权。当前预览不会自动反查城市，你仍可以在城市选择器中手动确认。')
      track('location_permission', { result: 'granted' })
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? (error as { status?: LocationStatus }).status : 'error'
      const next = status === 'denied' || status === 'unavailable' ? status : 'error'
      setLocationStatus(next)
      setInfo(next === 'denied' ? '定位权限已拒绝，你仍可正常使用并手动选择城市。' : '暂时无法获取当前位置，请检查系统设置后重试。')
      track('location_permission', { result: next })
    }
  }
  const locationLabel = locationStatus === 'granted' ? '已授权' : locationStatus === 'denied' ? '已拒绝' : locationStatus === 'requesting' ? '请求中' : ''
  return <AppShell><ZouNavigationBar title="设置" /><div className="page-content settings-list"><section><h2>本机数据</h2><p>备份包含输入与附件，请自行保管。清理前先撤销需要失效的分享；清理后设备会话结束，未备份的本地数据无法恢复。</p><button type="button" onClick={exportLocalData}>导出本机数据</button><button type="button" onClick={()=>setConfirmErase(true)}>删除本机数据并退出设备会话</button>{confirmErase?<div role="alert"><p>确认删除本机全部走走旅行、草稿、附件、清单和费用？</p><button type="button" onClick={()=>void eraseLocalData()}>确认删除本机数据</button><button type="button" onClick={()=>setConfirmErase(false)}>取消</button></div>:null}<p role="status">{dataMessage}</p></section><label className="settings-row"><span><strong>显示地点顺序</strong><small>走走只整理地点；打开地图时交给手机地图 App</small></span><input aria-label="显示地点顺序" type="checkbox" role="switch" checked={communityMapVisible} onChange={(e) => setCommunityMapVisible(e.target.checked)} /></label><label className="settings-row"><span><strong>减少动态效果</strong><small>关闭大范围 Morph、Hero 位移与镜头推进</small></span><input aria-label="减少动态效果" type="checkbox" role="switch" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /></label>{['账号与安全', '隐私', '通知', '定位权限', '关于走走'].map((item) => <button type="button" key={item} onClick={() => { void openSetting(item) }}>{item}{item === '定位权限' && locationLabel ? <small>{locationLabel}</small> : null}<ChevronRight /></button>)}</div><ZouBottomSheet open={info !== null} onClose={() => setInfo(null)} title="设置说明"><p>{info}</p></ZouBottomSheet></AppShell>
}

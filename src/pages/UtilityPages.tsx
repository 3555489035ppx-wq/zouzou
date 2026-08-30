import { useState } from 'react'
import { AtSign, Bell, ChevronRight, Heart, MapPin, MessageCircle, Settings, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ZouBottomSheet, ZouButton, ZouNavigationBar, ZouPlanCard, ZouSegmentedControl } from '../components/ui'
import { plans } from '../demo-data/trips'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { requestCurrentLocation, type LocationStatus } from '../services/location'

export const NotificationsPage = () => {
  const [tab, setTab] = useState('行程')
  const items = tab === '行程'
    ? [{ icon: UserPlus, title: '林晓接受了旅行邀请', body: '上海三天两晚 · 刚刚' }, { icon: Bell, title: '投票将在今晚 22:00 结束', body: '目前「最匹配」领先 1 票' }]
    : tab === '社区'
      ? [{ icon: Heart, title: '阿柚喜欢了你的行程', body: '武康路不赶时间的 City Walk' }, { icon: MessageCircle, title: '野生小海回复了你', body: '“下午去美术馆这个安排很聪明。”' }]
      : [{ icon: Settings, title: '减少动态效果', body: '可以在设置中随时调整' }]
  return <AppShell><ZouNavigationBar title="通知" /><div className="page-content"><ZouSegmentedControl options={['行程', '社区', '系统']} value={tab} onChange={setTab} /><div className="notification-list">{items.map(({ icon: Icon, title, body }) => <button key={title}><span><Icon /></span><div><strong>{title}</strong><small>{body}</small></div><ChevronRight /></button>)}</div></div></AppShell>
}

const quickConfig = {
  weekend: { title: '周末去哪？', body: '告诉我想随便逛逛，还是安排完整的一天。', fields: ['探索附近', '安排一天'], plans: ['附近最顺路', '室内多一点', '松弛的一天'] },
  date: { title: '这次约会想怎么走？', body: '时间、预算和关系阶段，会改变一条路线的节奏。', fields: ['第一次见面', '稳定关系'], plans: ['最匹配', '轻松', '特别一点'] },
  dining: { title: '朋友一起决定吃什么', body: '先收集预算、辣度、忌口、菜系和距离，再投票。', fields: ['收集朋友意见', '直接生成'], plans: ['最符合所有人', '距离最近', '特别一点'] },
}

export const QuickPlannerPage = ({ kind }: { kind: keyof typeof quickConfig }) => {
  const navigate = useNavigate()
  const config = quickConfig[kind]
  const [mode, setMode] = useState(config.fields[0])
  const [generated, setGenerated] = useState(false)
  const [selected, setSelected] = useState('match')
  const [sheet, setSheet] = useState(false)
  return <AppShell><ZouNavigationBar title={kind === 'weekend' ? '周末' : kind === 'date' ? '约会' : '聚餐'} /><div className="page-content quick-planner"><header><h1>{config.title}</h1><p>{config.body}</p></header><ZouSegmentedControl options={config.fields} value={mode} onChange={setMode} /><label>你的想法<textarea defaultValue={kind === 'dining' ? '四个人，预算人均 150，一位朋友不吃海鲜，希望地铁方便。' : kind === 'date' ? '周六下午，两个人，预算 500，不想一直排队。' : '周日下午，不想走太多，想看展和喝咖啡。'} /></label>{!generated ? <ZouButton onClick={() => setGenerated(true)}>生成 3 套方案</ZouButton> : <div className="quick-results">{plans.map((plan, index) => <ZouPlanCard key={plan.id} plan={{ ...plan, label: config.plans[index] }} selected={selected === plan.id} onSelect={() => setSelected(plan.id)} onOpen={() => setSheet(true)} />)}</div>}<ZouBottomSheet open={sheet} onClose={() => setSheet(false)} title="这套方案已选中"><p>这套方案会复用你的路线、投票和预算设置，不需要重新填写。</p><ZouButton onClick={() => kind === 'dining' ? navigate('/travel/vote') : navigate('/trips')}>{kind === 'dining' ? '邀请朋友投票' : '保存并查看路线'}</ZouButton></ZouBottomSheet></div></AppShell>
}

export const SettingsPage = () => {
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const communityMapVisible = useAppStore((s) => s.communityMapVisible)
  const setCommunityMapVisible = useAppStore((s) => s.setCommunityMapVisible)
  const [info, setInfo] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const settingCopy: Record<string, string> = {
    '账号与安全': '本地预览使用演示账号。正式上线前需要接入服务端 session、退出登录、注销和数据删除。',
    '隐私': '旅行文本、截图和精确路线只用于生成与展示；当前预览不上传埋点，生产环境需要提供留存期限、删除和导出入口。',
    '通知': '通知设置会在正式账号服务接入后同步到设备，本地预览暂不发送推送。',
    '关于走走': '走走是一个把城市路线整理成可执行行程的体验原型。路线和第三方价格仍需出行前核对。',
  }
  const openSetting = async (item: string) => {
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
  return <AppShell><ZouNavigationBar title="设置" /><div className="page-content settings-list"><label className="settings-row"><span><strong>减少动态效果</strong><small>关闭大范围 Morph、Hero 位移与镜头推进</small></span><input aria-label="减少动态效果" type="checkbox" role="switch" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /></label><label className="settings-row"><span><strong>社区回放显示地图</strong><small>只影响社区内容，自己的行程地图始终保留</small></span><input aria-label="社区回放显示地图" type="checkbox" role="switch" checked={communityMapVisible} onChange={(e) => setCommunityMapVisible(e.target.checked)} /></label>{['账号与安全', '隐私', '通知', '定位权限', '关于走走'].map((item) => <button type="button" key={item} onClick={() => { void openSetting(item) }}>{item}{item === '定位权限' && locationLabel ? <small>{locationLabel}</small> : null}<ChevronRight /></button>)}</div><ZouBottomSheet open={info !== null} onClose={() => setInfo(null)} title="设置说明"><p>{info}</p></ZouBottomSheet></AppShell>
}

import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ZouButton, ZouMotionBot } from '../components/ui'
import { ZouLogo } from '../components/ZouLogo'
import { useAppStore } from '../stores/appStore'

const routes = [
  ['启动', '/'], ['登录', '/login'], ['新用户', '/onboarding'], ['首页', '/home'], ['旅行输入', '/travel/new'],
  ['AI Loading', '/travel/understanding'], ['AI Error', '/travel/understanding?error=1'], ['三方案', '/travel/plans'], ['方案详情', '/travel/plan/match'],
  ['朋友意见', '/travel/friends'], ['Vote Open', '/travel/vote'], ['Vote Complete', '/travel/vote?complete=1'], ['行程', '/trips'],
  ['行程到站', '/trips?arrival=1'], ['行程偏离', '/trips?deviation=1'], ['行程回放', '/trips/shanghai/replay'],
  ['社区发现', '/community'], ['社区搜索', '/community/search'], ['Community Replay', '/community/post-1/replay'],
  ['发布', '/community/publish'], ['我的', '/profile'], ['我的收藏', '/profile/favorites'], ['通知', '/notifications'], ['设置', '/settings'],
]

export const DemoPage = () => {
  const navigate = useNavigate()
  const tripMode = useAppStore((s) => s.tripMode)
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const setTripMode = useAppStore((s) => s.setTripMode)
  const setReducedMotion = useAppStore((s) => s.setReducedMotion)
  const resetDemo = useAppStore((s) => s.resetDemo)
  return <AppShell><div className="demo-center"><header><ZouLogo /><div><h1>走走 Demo Center</h1><p>仅开发查看，不出现在正式产品 UI。</p></div></header><section><h2>直接访问</h2><div className="demo-route-grid">{routes.map(([label, path]) => <button key={path} onClick={() => navigate(path)}><span>{label}</span><code>{path}</code></button>)}</div></section><section><h2>行程状态</h2><div className="demo-state-row">{(['none', 'upcoming', 'active', 'completed'] as const).map((mode) => <button key={mode} aria-pressed={tripMode === mode} onClick={() => setTripMode(mode)}>{mode}</button>)}</div></section><section><h2>Motion Bot 状态</h2><div className="demo-bots">{(['idle', 'listening', 'reading', 'thinking', 'planning', 'updating', 'success', 'alert', 'error', 'walking'] as const).map((state) => <div key={state}><ZouMotionBot state={state} size="sm" /><span>{state}</span></div>)}</div></section><section className="demo-settings"><label>减少动态效果<input type="checkbox" role="switch" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label><ZouButton variant="secondary" onClick={resetDemo}>重置 Demo 状态</ZouButton></section></div></AppShell>
}

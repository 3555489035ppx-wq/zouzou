import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { OpenMapButton } from '../components/MapLauncher'
import { ZouNavigationBar } from '../components/ui'
import type { MapPlace } from '../services/mapLauncher'

type SharedStop = MapPlace & { time: string; stay: string; budget?: number; priceState?: string }
type SharedSnapshot = {
  title: string; revision: number; city?: string
  budget?: number | { limit?: number | null; total?: number | null; label?: string } | null
  updatedAt?: string | number; expiresAt?: number
  dates?: { start: string; end: string }; partySize: number; places: number; arrangements: number
  scope: string; days: Record<string, SharedStop[]>
}

const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `¥${value.toLocaleString('zh-CN')}` : null
const budgetText = (budget: SharedSnapshot['budget']) => {
  if (budget && typeof budget === 'object') {
    const parts = [money(budget.total) ? `预计费用约 ${money(budget.total)}` : null, money(budget.limit) ? `预算上限 ${money(budget.limit)}` : null, typeof budget.label === 'string' ? budget.label.trim() : null].filter(Boolean)
    return parts.length ? parts.join(' · ') : '总预算未提供'
  }
  return money(budget) ? `预算约 ${money(budget)}` : '总预算未提供'
}
const updatedTime = (value: SharedSnapshot['updatedAt']) => {
  if (value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('zh-CN')
}

// A keyed reader prevents even one render of the previous token's private body.
export function SharedTripPage() {
  const { token } = useParams()
  return <SharedTripReader key={token ?? ''} token={token} />
}

function SharedTripReader({ token }: { token?: string }) {
  const [data, setData] = useState<SharedSnapshot | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let generation = 0
    let controller: AbortController | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const clear = () => {
      generation += 1
      controller?.abort()
      clearTimeout(timeout)
      setData(null)
      setError('')
      document.title = '只读旅行路书 · 走走'
    }
    const read = async () => {
      clear()
      if (!token) { setError('分享链接不完整。'); return }
      const request = generation
      const current = new AbortController()
      controller = current
      timeout = setTimeout(() => {
        if (!active || request !== generation) return
        generation += 1
        current.abort()
        setData(null)
        setError('读取分享超时，请检查网络后重试。')
      }, 12_000)
      try {
        // No browser HTTP cache, local/session storage, or offline body fallback.
        const response = await fetch(`/api/shares/${encodeURIComponent(token)}`, { signal: current.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404 || response.status === 403 || response.status === 410 ? '分享已失效、撤销或不存在。' : '暂时无法读取分享，请稍后重试。')
        const value: SharedSnapshot = await response.json()
        if (!value || typeof value.title !== 'string' || !value.days || typeof value.days !== 'object' || Array.isArray(value.days) || !Object.values(value.days).every(stops => Array.isArray(stops) && stops.every(stop => stop && typeof stop.name === 'string'))) throw new Error('分享内容格式异常，请重试。')
        if (!active || request !== generation || current.signal.aborted) return
        setData(value)
        document.title = `${value.title} · 走走`
      } catch (cause) {
        if (active && request === generation && !current.signal.aborted) setError(cause instanceof Error ? cause.message : '读取失败，请重试。')
      } finally {
        if (request === generation) clearTimeout(timeout)
      }
    }
    const visibility = () => { if (document.visibilityState === 'hidden') clear(); else void read() }
    const focus = () => { if (document.visibilityState !== 'hidden') void read() }
    const pageHide = () => clear()
    const pageShow = (event: PageTransitionEvent) => { if (event.persisted) void read() }
    void read()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('focus', focus)
    window.addEventListener('pagehide', pageHide)
    window.addEventListener('pageshow', pageShow)
    return () => {
      active = false
      generation += 1
      controller?.abort()
      clearTimeout(timeout)
      document.title = '走走'
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('focus', focus)
      window.removeEventListener('pagehide', pageHide)
      window.removeEventListener('pageshow', pageShow)
    }
  }, [token, attempt])

  return <AppShell><ZouNavigationBar title="只读旅行路书" back={false}/><main className="page-content">
    {error ? <><p role="alert">{error}</p><button type="button" className="open-map-button" onClick={() => { setError(''); setData(null); setAttempt(value => value + 1) }}>重新读取</button></> : data ? <>
      <h1>{data.title}</h1>
      <p>{data.city || '城市待确认'} · {data.dates ? `${data.dates.start}—${data.dates.end}` : '日期待确认'} · {data.partySize}人 · {data.places}个地点 · {data.arrangements}项安排</p>
      <p>{budgetText(data.budget)} · {updatedTime(data.updatedAt) ? `更新于 ${updatedTime(data.updatedAt)}` : '更新时间未提供'}</p>
      <p>版本{data.revision} · {data.scope}</p>
      {Object.entries(data.days).map(([day, stops]) => <section key={day}><h2>{day} · {stops.length}站</h2>{stops.map((stop, index) => <article key={`${stop.id}-${index}`}>
        <h3>{index + 1}. {stop.name}</h3><p>{stop.time} · {stop.stay}</p><p>{stop.address || '地址待确认'}</p>
        <p>{stop.priceState === 'unknown' || !money(stop.budget) ? '费用待确认' : `地点预算约 ${money(stop.budget)}`}</p>
        <OpenMapButton place={stop} city={stop.city ?? data.city} compact />
      </article>)}</section>)}
    </> : <p role="status">正在读取分享内容…</p>}
  </main></AppShell>
}

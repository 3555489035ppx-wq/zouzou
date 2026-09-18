// 诊断 completePlanOptions 为什么淘汰方案：逐天逐时段打印覆盖情况。
import { generatePlans, type GeneratedPlan } from '../src/services/trip/planner'
import { getLocalGuideContext } from '../src/services/trip/localGuides'
import type { TripIntent } from '../src/services/trip/planner'

const timeToMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + (m || 0) }
const MEAL_WINDOWS: Array<[string, number, number, number]> = [['早餐', 7 * 60, 11 * 60, 35], ['午餐', 12 * 60, 14 * 60 + 30, 60], ['晚餐', 18 * 60, 20 * 60 + 30, 60]]
const DAILY_VISITS = [
  { type: '上午', start: 9 * 60, end: 12 * 60 },
  { type: '下午', start: 14 * 60, end: 18 * 60 },
  { type: '晚间', start: 18 * 60, end: 21 * 60 + 30 },
]
const isMeal = (stop: { type?: string }) => /早餐|午餐|晚餐|餐/.test(stop.type || '')

// 直接用线上 understand 返回的真实 intent，避免手写对象缺字段导致误判。
const BASE = process.env.ZOUZOU_API_BASE_URL || 'https://zouzou.ppx.wiki'
const TEXTS = [
  { id: 'SHOT-截图输入', text: '上海3天，2个人，人均预算4000元，想去武康路、安福路和外滩，想看展。' },
  { id: 'TEST04-上海2天+武康路', text: '上海两天，必须去武康路，不要去外滩。' },
  { id: 'TEST05-大理3天', text: '大理3天，预算较低，喜欢自然，不喜欢购物。' },
]
const CASES: Array<{ id: string; intent: TripIntent }> = []
for (const item of TEXTS) {
  const response = await fetch(`${BASE}/api/trips/understand`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: item.text, media: [] }) })
  const data = await response.json() as { intent: TripIntent }
  CASES.push({ id: item.id, intent: data.intent })
}

for (const item of CASES) {
  console.log(`\n########## ${item.id}`)
  const context = getLocalGuideContext(item.intent.destination, [item.intent.destination, ...item.intent.mustVisit, ...item.intent.preferences].join(' '))
  console.log('候选攻略数:', context.candidates?.length ?? 0)
  const plans = generatePlans(item.intent, context, { enabled: false })
  for (const plan of plans as GeneratedPlan[]) {
    console.log(`\n  --- 方案 ${plan.label}  nights=${plan.nights}`)
    const entries = Object.entries(plan.days)
    for (const [dayName, day] of entries) {
      if (!day.length) { console.log(`    ${dayName}: 空`); continue }
      const first = day[0]
      const start = timeToMinutes(first.time) + (first.fixed ? first.durationMinutes + 25 : 0)
      const returning = day.find((stop) => stop.type === '返程')
      const end = Math.min(returning ? timeToMinutes(returning.time) - 30 : 22 * 60, 22 * 60)
      const meals = MEAL_WINDOWS.map(([type, floor, ceiling, duration]) => {
        const covered = start > ceiling || Math.max(start, floor) + duration > end || day.some((stop) => stop.type === type && !stop.pendingVenue)
        return `${type}:${covered ? 'ok' : 'MISS'}`
      })
      const visits = DAILY_VISITS.map((period) => {
        const covered = start > period.start + 30 || end < period.end || day.some((stop) => !stop.fixed && !isMeal(stop) && stop.type !== '休息' && timeToMinutes(stop.time) < period.end && timeToMinutes(stop.time) + stop.durationMinutes > period.start)
        return `${period.type}:${covered ? 'ok' : 'MISS'}`
      })
      const pending = day.filter((stop) => isMeal(stop) && stop.pendingVenue).map((stop) => `${stop.type}待定`)
      const hotel = day.some((stop) => /酒店|住宿/.test(stop.type || '') && !/待选|待确认/.test(stop.name))
      console.log(`    ${dayName} ${String(day.length).padStart(2)}站 start=${first.time} end=${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')} | ${meals.join(' ')} | ${visits.join(' ')}${pending.length ? ' | 待定:' + pending.join(',') : ''}${plan.nights ? ' | 酒店:' + (hotel ? 'ok' : 'MISS') : ''}`)
      console.log('      站点:', day.map((stop) => `${stop.time}${stop.type || ''}:${stop.name}`).join(' → '))
    }
  }
}

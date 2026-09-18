// 任务书 §58 必测矩阵：本地跑共享规划器核心（不消耗线上 AI 配额）。
import { completePlanOptions, generatePlans, understandTrip, type TripIntent } from '../src/services/trip/planner'
import { getLocalGuideContext } from '../src/services/trip/localGuides'
import { cityNames } from '../src/demo-data/cities'

type Case = { id: string; text: string; pageCity?: string; expect: 'PASS' | 'ASK_CITY'; mustInclude?: string[]; mustExclude?: string[] }

const CASES: Case[] = [
  { id: '01 只给城市', text: '上海', expect: 'PASS' },
  { id: '02 城市+天数', text: '上海3天', expect: 'PASS' },
  { id: '03 城市+兴趣', text: '上海，想拍照', expect: 'PASS' },
  { id: '04 城市+同行', text: '上海，和女朋友', expect: 'PASS' },
  { id: '05 周末', text: '周末去上海走走', expect: 'PASS' },
  { id: '06 地点反推城市', text: '武康路、安福路玩一天', expect: 'PASS' },
  { id: '07 继承页面城市', text: '想轻松逛逛', pageCity: '上海', expect: 'PASS' },
  { id: '08 截图输入', text: '上海3天，2个人，人均4000，武康路、安福路、外滩，看展。', expect: 'PASS', mustInclude: ['武康路', '安福路'] },
  { id: '09 约束输入', text: '上海3天，2个人，情侣，人均4000，必须去武康路，想看展、喝咖啡、拍照，不想太累，不要外滩。', expect: 'PASS', mustInclude: ['武康路'], mustExclude: ['外滩'] },
  { id: '10 无城市', text: '随便玩玩', expect: 'ASK_CITY' },
]

function run(item: Case) {
  const text = item.pageCity ? `${item.pageCity}，${item.text}` : item.text
  const { intent } = understandTrip({ text, media: [] })
  const destination = intent.destination || item.pageCity || ''
  if (!destination || !cityNames.includes(destination)) {
    return { ok: item.expect === 'ASK_CITY', note: `无法确定城市（destination="${intent.destination}"）→ ASK_CITY`, intent, plans: [] as ReturnType<typeof generatePlans> }
  }
  if (item.expect === 'ASK_CITY') return { ok: false, note: '本应 ASK_CITY，但解析出了城市', intent, plans: [] }
  const context = getLocalGuideContext(destination, [destination, ...intent.mustVisit, ...intent.preferences].join(' '))
  try {
    const plans = completePlanOptions(generatePlans(intent as TripIntent, context, { enabled: false }))
    const allStops = plans.flatMap((plan) => Object.values(plan.days).flat())
    const names = allStops.map((stop) => stop.name).join(' ')
    // 餐厅可能恰好叫「外滩家宴」，所以禁去地点只按非用餐站点判断。
    const placeNames = allStops.filter((stop) => !/早餐|午餐|晚餐|餐/.test(stop.type || '')).map((stop) => stop.name).join(' ')
    const missing = (item.mustInclude ?? []).filter((term) => !names.includes(term))
    // 酒店名可能带「外滩」、餐厅可能叫「外滩家宴」，禁去地点只按景点级精确匹配。
    const placeOnly = allStops.filter((stop) => !/早餐|午餐|晚餐|餐/.test(stop.type || '') && !/住宿|酒店/.test(stop.type || '')).map((stop) => stop.name)
    const present = (item.mustExclude ?? []).filter((term) => placeOnly.some((name) => name === term || name.startsWith(term + '（')))
    const problems: string[] = []
    if (missing.length) problems.push(`缺必去: ${missing.join('/')}`)
    if (present.length) problems.push(`出现禁去: ${present.join('/')}`)
    const dayCounts = plans.map((plan) => Object.keys(plan.days).length)
    if (new Set(dayCounts).size > 1) problems.push(`天数不一致: ${dayCounts.join('/')}`)
    return { ok: problems.length === 0, note: `${plans.length} 个方案 · ${dayCounts.join('/')} 天${problems.length ? ' · ' + problems.join('; ') : ''}`, intent, plans }
  } catch (error) {
    return { ok: false, note: `规划失败: ${error instanceof Error ? error.message.slice(0, 40) : String(error)}`, intent, plans: [] }
  }
}

let pass = 0
for (const item of CASES) {
  const result = run(item)
  if (result.ok) pass += 1
  const intent = result.intent as TripIntent
  console.log(`${result.ok ? '✅ PASS' : '❌ FAIL'}  ${item.id}`)
  console.log(`     输入: ${item.text}${item.pageCity ? `（页面城市 ${item.pageCity}）` : ''}`)
  console.log(`     解析: city=${intent.destination || '空'} days=${intent.durationDays} party=${intent.partySize} budget=${intent.budget ?? '未知'} 必去=${(intent.mustVisit || []).join('/') || '无'} 偏好=${(intent.preferences || []).slice(0, 4).join('/') || '无'}`)
  console.log(`     结果: ${result.note}`)
}
console.log(`\n矩阵: ${pass}/${CASES.length} PASS`)
process.exit(pass === CASES.length ? 0 : 1)

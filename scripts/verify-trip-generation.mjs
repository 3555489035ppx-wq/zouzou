// 端到端链路验证：直接打线上接口，跑通「理解 → 生成」并核对输出是否满足用户要求。
// 用法：node scripts/audit-trip-e2e.mjs
const BASE = process.env.ZOUZOU_API_BASE_URL || 'https://zouzou.ppx.wiki'

/** 与小程序 api.request 相同：不带 Origin，避免命中服务端的跨站拦截。 */
async function post(path, body) {
  const startedAt = Date.now()
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 300) } }
  return { status: response.status, data, ms: Date.now() - startedAt }
}

const CASES = [
  { id: 'TEST01', label: '上海', text: '上海两天，和女朋友，人均500，想拍照、吃东西、喝咖啡，不想走太累，不想去太网红排队的地方。' },
  { id: 'TEST02', label: '长沙', text: '长沙一天，和朋友，预算300，主要想吃东西，不要太多景点。' },
  { id: 'TEST03', label: '成都', text: '成都三天，一个人，想轻松一点，不要网红排队，想体验本地生活。' },
  { id: 'TEST04', label: '上海(约束)', text: '上海两天，必须去武康路，不要去外滩。' },
  { id: 'TEST05', label: '大理', text: '大理3天，预算较低，喜欢自然，不喜欢购物。' },
  { id: 'TEST06', label: '北京', text: '北京三天，两个人，预算3000，想看历史建筑，不想太赶。' },
]

const results = []
for (const item of CASES) {
  const record = { id: item.id, label: item.label, understand: '', generate: '', plans: 0, issues: [] }
  const understood = await post('/api/trips/understand', { text: item.text, media: [] })
  if (understood.status !== 200) {
    record.understand = `HTTP ${understood.status} ${understood.data?.code || ''} ${understood.data?.message || ''}`
    record.issues.push('understand 失败')
    results.push(record)
    continue
  }
  const intent = understood.data.intent
  record.understand = `${intent.destination} · ${intent.durationDays}天 · ${intent.partySize}人 · 预算${intent.budget ?? '未填'} · 节奏${intent.pace}`
  record.preferences = intent.preferences
  record.mustVisit = intent.mustVisit

  const generated = await post('/api/trips/generate', { understanding: { intent } })
  if (generated.status !== 200) {
    record.generate = `HTTP ${generated.status} ${generated.data?.code || ''} ${generated.data?.message || ''}`
    record.issues.push('generate 失败')
    results.push(record)
    continue
  }
  const plans = generated.data.plans || []
  record.plans = plans.length
  record.generate = `HTTP 200 · ${plans.length} 个方案 · provider=${generated.data.provider}`
  record.labels = plans.map((plan) => plan.label).join(' / ')
  record.daysPerPlan = plans.map((plan) => Object.keys(plan.days || {}).length).join('/')

  // HARD CONSTRAINT 核对
  for (const plan of plans) {
    const dayCount = Object.keys(plan.days || {}).length
    if (dayCount !== intent.durationDays) record.issues.push(`${plan.label}: 天数 ${dayCount} ≠ ${intent.durationDays}`)
    if (plan.city && plan.city !== intent.destination) record.issues.push(`${plan.label}: 城市 ${plan.city} ≠ ${intent.destination}`)
    const names = Object.values(plan.days || {}).flat().map((stop) => stop.name).join(' ')
    for (const must of intent.mustVisit || []) if (!names.includes(must)) record.issues.push(`${plan.label}: 缺必去地点 ${must}`)
    for (const avoid of intent.unavailablePlaces || []) if (names.includes(avoid)) record.issues.push(`${plan.label}: 出现禁去地点 ${avoid}`)
  }
  results.push(record)
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

for (const record of results) {
  console.log(`\n=== ${record.id} ${record.label}`)
  console.log('  理解:', record.understand)
  if (record.preferences) console.log('  偏好:', record.preferences.join('/'), '| 必去:', (record.mustVisit || []).join('/') || '无')
  console.log('  生成:', record.generate)
  if (record.labels) console.log('  方案:', record.labels, '| 各方案天数:', record.daysPerPlan)
  console.log('  问题:', record.issues.length ? record.issues.join('; ') : '无')
}
console.log('\n' + JSON.stringify({ cases: results.length, failed: results.filter((r) => r.issues.length).length }, null, 2))

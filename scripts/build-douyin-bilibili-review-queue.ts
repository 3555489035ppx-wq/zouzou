import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve('tools/travel-kb/private/three-platform')
const REVIEW = resolve('docs/qa/three-platform-first-20-city-review.json')
const OUTPUT = resolve(ROOT, 'second-pass', 'douyin-to-bilibili')

type ReviewRow = { recordId: string; city: string; platform: string; decision: string; reason: string; score: number }
type SourceRecord = { record_id: string; city: string; source_title?: string; evidence_refs?: Array<{ paraphrase?: string }> }

const compact = (value: string) => value
  .replace(/#[^\s#]+/g, ' ')
  .replace(/[《》【】“”"'～~]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function recordsById() {
  const result = new Map<string, SourceRecord>()
  const recordsRoot = resolve(ROOT, 'records')
  for (const city of readdirSync(recordsRoot)) {
    const directory = resolve(recordsRoot, city)
    for (const name of readdirSync(directory)) {
      if (!name.startsWith('dy-') || !name.endsWith('.json')) continue
      const row = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as SourceRecord
      result.set(row.record_id, row)
    }
  }
  return result
}

const report = JSON.parse(readFileSync(REVIEW, 'utf8')) as { reviews: ReviewRow[] }
const records = recordsById()
const byCity = new Map<string, Array<{ douyinRecordId: string; query: string; score: number; reason: string }>>()

for (const row of report.reviews) {
  if (row.platform !== 'douyin' || row.decision !== 'hold' || row.reason === 'wrong_city') continue
  const source = records.get(row.recordId)
  if (!source) continue
  const raw = compact(source.source_title || source.evidence_refs?.[0]?.paraphrase || '')
  const useful = raw.replace(new RegExp(row.city, 'g'), ' ').replace(/旅游|旅行|攻略|推荐|保姆级|视频|告诉你|怎么玩/g, ' ').replace(/\s+/g, ' ').trim()
  const topic = useful.length >= 4 ? useful.slice(0, 42) : '详细路线 交通 住宿 美食 避坑'
  const query = `${row.city} ${topic} 攻略 路线`.replace(/\s+/g, ' ').trim()
  const list = byCity.get(row.city) ?? []
  list.push({ douyinRecordId: row.recordId, query, score: row.score, reason: row.reason })
  byCity.set(row.city, list)
}

mkdirSync(OUTPUT, { recursive: true })
const cities: Record<string, unknown> = {}
for (const [city, rows] of byCity) {
  const seen = new Set<string>()
  const selected = rows
    .sort((a, b) => b.score - a.score)
    .filter(row => !seen.has(row.query) && Boolean(seen.add(row.query)))
    .slice(0, 8)
  cities[city] = { heldDouyin: rows.length, selectedQueries: selected.length, mappings: selected }
  writeFileSync(resolve(OUTPUT, `${city}-queries.txt`), `${selected.map(row => row.query).join('\n')}\n`, 'utf8')
}

const queue = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  rule: 'Held Douyin records remain held; Bilibili sources collected from same-city topic queries retain Bilibili provenance and pass the normal semantic review independently.',
  cities,
}
writeFileSync(resolve(OUTPUT, 'queue.json'), `${JSON.stringify(queue, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ cities: Object.keys(cities).length, heldMapped: [...byCity.values()].reduce((sum, rows) => sum + rows.length, 0), selectedQueries: Object.values(cities).reduce<number>((sum, value) => sum + (value as { selectedQueries: number }).selectedQueries, 0), output: OUTPUT }))

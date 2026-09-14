import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCityKnowledge, cityKnowledge, type CityKnowledgeItem } from '../src/services/trip/cityKnowledge'
import { cityNames } from '../src/demo-data/cities'
import type { GuideCandidate, GuideKnowledgeBase, GuidePlatform } from '../src/services/trip/guides'

const ROOT = resolve('tools/travel-kb/private/three-platform')
const OUTPUT = resolve('data/travel-guides-reviewed-20-cities.json')
const REPORT = resolve('docs/qa/three-platform-first-20-city-review.json')
const BATCHES = [1, 2, 3, 4] as const

const parseJsonFile = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as T

export type SourceRecord = {
  record_id: string
  platform: 'bilibili' | 'douyin' | 'xiaohongshu'
  source_url: string
  source_title: string
  city: string
  author?: string
  published_at?: string | null
  observed_at?: string
  evidence_mode?: string
  evidence_refs?: Array<{ locator?: string; paraphrase?: string }>
  scenario?: string[]
  target_users?: string[]
  day_patterns?: unknown[]
  area_combinations?: unknown[]
  poi_sequences?: Array<{ sequence?: string[] }>
  meal_patterns?: unknown[]
  food_experiences?: unknown[]
  stay_area_advice?: unknown[]
  photo_experience?: unknown[]
  cultural_experience?: unknown[]
  night_experience?: unknown[]
  pitfalls?: unknown[]
  plan_b?: unknown[]
  content_hash?: string
  review_status?: string
}

export type ReviewReason = 'usable' | 'wrong_city' | 'insufficient_detail' | 'no_concrete_match' | 'unsupported_platform'
export type ReviewedRecord = {
  recordId: string
  city: string
  platform: string
  sourceUrl: string
  decision: 'runtime_candidate' | 'hold'
  reason: ReviewReason
  score: number
  matchedPlaces: string[]
  matchedFoods: string[]
  matchedHotels: string[]
  evidenceCharacters: number
}

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const unique = <T>(values: T[]) => [...new Set(values)]

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [compact(value)]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

export function evidenceText(record: SourceRecord) {
  const structured = [record.scenario, record.target_users, record.day_patterns, record.area_combinations,
    record.poi_sequences, record.meal_patterns, record.food_experiences, record.stay_area_advice,
    record.photo_experience, record.cultural_experience, record.night_experience, record.pitfalls, record.plan_b]
  return compact(unique([
    compact(record.source_title),
    ...(record.evidence_refs ?? []).map(ref => compact(ref.paraphrase ?? '')),
    ...structured.flatMap(stringsIn),
  ].filter(Boolean)).join(' '))
}

function evidenceBodyText(record: SourceRecord) {
  const structured = [record.scenario, record.target_users, record.day_patterns, record.area_combinations,
    record.poi_sequences, record.meal_patterns, record.food_experiences, record.stay_area_advice,
    record.photo_experience, record.cultural_experience, record.night_experience, record.pitfalls, record.plan_b]
  return compact(unique([
    ...(record.evidence_refs ?? []).map(ref => compact(ref.paraphrase ?? '')),
    ...structured.flatMap(stringsIn),
  ].filter(Boolean)).join(' '))
}

function aliases(item: CityKnowledgeItem) {
  const values = [item.name, item.venueName, ...(item.menuHighlights ?? [])]
    .flatMap(value => value ? [value, ...value.split(/[｜—·（）()]/)] : [])
    .map(compact)
  const stems = values.map(value => value
    .replace(/^(?:上海|杭州|苏州|南京|成都|厦门|北京|广州|重庆|西安|深圳|长沙|青岛|武汉|昆明|三亚|桂林|哈尔滨|贵阳|张家界)/, '')
    .replace(/(?:国家)?(?:森林|湿地|地质)?公园$|风景名胜区$|风景区$|旅游区$|景区$|博物馆$|美术馆$|艺术馆$|纪念馆$|科技馆$|古镇$|古城$/, ''))
    .filter(value => value.length >= 3)
  return unique([...values, ...stems]
    .filter(value => value.length >= 2 && !/^(本地|城市|景区|公园|博物馆|美食|小吃|午餐|晚餐|早餐)$/.test(value))
  )
}

function matchedKnowledge(record: SourceRecord) {
  const text = evidenceText(record)
  const knowledge = getCityKnowledge(record.city)
  const matched = knowledge.items.filter(item => aliases(item).some(alias => text.includes(alias)))
  const places = unique(matched.filter(item => !['food', 'restaurant'].includes(item.category)).map(item => item.name))
  const foods = unique(matched.filter(item => ['food', 'restaurant'].includes(item.category))
    .flatMap(item => [item.venueName ?? item.name, ...(item.menuHighlights ?? [])]).filter(value => text.includes(value)))
  // An area mention supports an accommodation-area hint, but it is not evidence
  // for a particular hotel. Named hotel candidates require an exact name match.
  const hotels = unique(knowledge.hotelOptions.filter(hotel => text.includes(hotel.name)).map(hotel => hotel.name))
  return { places, foods, hotels }
}

const destinationNames = unique([...Object.keys(cityKnowledge), ...cityNames]).sort((a, b) => b.length - a.length)

function inferredDestination(record: SourceRecord) {
  const text = evidenceBodyText(record)
  const hashtag = destinationNames.find(city => new RegExp(`#${city}(?:旅游|旅行|攻略|一日游|拍照|美食)`).test(text))
  if (hashtag) return hashtag
  const ranked = destinationNames.map(city => ({ city, mentions: Math.max(0, text.split(city).length - 1) }))
    .filter(item => item.mentions > 0).sort((left, right) => right.mentions - left.mentions)
  const assignedMentions = ranked.find(item => item.city === record.city)?.mentions ?? 0
  return assignedMentions === 0 && (ranked[0]?.mentions ?? 0) >= 2 ? ranked[0].city : record.city
}

export function hasWrongCitySignal(record: SourceRecord) {
  // Source titles often contain the directory/search city even when the body
  // describes a different destination, so assignment checks use body evidence.
  const text = evidenceBodyText(record)
  const assigned = record.city
  const otherHashtags = destinationNames.filter(city => city !== assigned && new RegExp(`#${city}(?:旅游|旅行|攻略|一日游|拍照|美食)`).test(text))
  const assignedHashtag = new RegExp(`#${assigned}(?:旅游|旅行|攻略|一日游|拍照|美食)`).test(text)
  if (otherHashtags.length > 0 && !assignedHashtag) return true
  const assignedMentions = Math.max(0, text.split(assigned).length - 1)
  if (assignedMentions === 0 && destinationNames.some(city => city !== assigned && text.split(city).length >= 3)) return true
  const departure = new RegExp(`(?:从)?${assigned}(?:到|去|出发去|出发到)([^，。#]{1,12})`).exec(text)?.[1] ?? ''
  return destinationNames.some(city => city !== assigned && departure.includes(city) && text.split(city).length >= 3)
}

function assignmentScore(record: SourceRecord) {
  const text = evidenceText(record)
  const cityMentions = Math.max(0, text.split(record.city).length - 1)
  const hashtag = new RegExp(`#${record.city}(?:旅游|旅行|攻略|一日游|拍照|美食)`).test(text) ? 20 : 0
  const concrete = matchedKnowledge(record)
  return hashtag + cityMentions * 3 + (concrete.places.length + concrete.foods.length + concrete.hotels.length) * 4
    - (hasWrongCitySignal(record) ? 40 : 0)
}

function detailSignals(record: SourceRecord, text: string) {
  const structured = [record.target_users, record.day_patterns, record.area_combinations, record.poi_sequences,
    record.meal_patterns, record.food_experiences, record.stay_area_advice, record.photo_experience,
    record.cultural_experience, record.night_experience, record.pitfalls, record.plan_b]
    .reduce((count, value) => count + (Array.isArray(value) && value.length > 0 ? 1 : 0), 0)
  const enumerated = (text.match(/(?:^|\s)(?:day\s*\d+|第?[一二三四五六七八九十\d]+[、.：:]|[①②③④⑤⑥⑦⑧⑨⑩])/gi) ?? []).length
  const practical = (text.match(/(?:地铁|公交|步行|入住|住宿|寄存|预约|排队|早餐|午餐|晚餐|路线|返程|避坑|雨天|亲子)/g) ?? []).length
  return { structured, enumerated, practical }
}

function adviceDimensions(record: SourceRecord) {
  const dimensions: string[] = []
  if (record.day_patterns?.length) dimensions.push('分日节奏')
  if (record.area_combinations?.length) dimensions.push('片区组合')
  if (record.meal_patterns?.length || record.food_experiences?.length) dimensions.push('餐饮安排')
  if (record.stay_area_advice?.length) dimensions.push('住宿片区')
  if (record.photo_experience?.length) dimensions.push('拍照体验')
  if (record.cultural_experience?.length) dimensions.push('文化体验')
  if (record.night_experience?.length) dimensions.push('夜间安排')
  if (record.pitfalls?.length) dimensions.push('避坑提醒')
  if (record.plan_b?.length) dimensions.push('备选方案')
  return dimensions
}

function adviceGuide(record: SourceRecord, text: string, dimensions: string[]): GuideCandidate {
  const platform = record.platform as GuidePlatform
  const libraryFor = (dimension: string): NonNullable<GuideCandidate['experiences']>[number]['library'] => {
    if (['分日节奏', '片区组合', '住宿片区'].includes(dimension)) return 'structure_pace'
    if (['餐饮安排', '拍照体验', '文化体验', '夜间安排'].includes(dimension)) return 'food_photo_culture'
    if (['避坑提醒', '备选方案'].includes(dimension)) return 'pitfalls_plan_b'
    return 'scenarios'
  }
  const evidenceLocator = record.evidence_refs?.find(ref => ref.locator)?.locator ?? 'reviewed structured fields'
  return {
    id: `reviewed20-${record.record_id}`,
    city: record.city,
    platform,
    sourceUrl: record.source_url,
    title: compact(record.source_title).slice(0, 80),
    author: compact(record.author ?? '来源作者'),
    publishedAt: record.published_at ?? null,
    fetchedAt: record.observed_at ?? new Date(0).toISOString(),
    likes: null,
    summary: `来源包含${dimensions.join('、')}；尚未确认新的具名地点，因此只参与节奏与偏好排序，具体地点仍由走走现有知识库提供。`,
    tags: dimensions.slice(0, 5),
    placeHints: [],
    foodHints: [],
    localExperienceHints: dimensions,
    hotelHints: dimensions.includes('住宿片区') ? ['正文包含住宿片区建议'] : [],
    hotelNames: [],
    dietaryTags: [],
    claims: [],
    experiences: dimensions.map(dimension => ({
      library: libraryFor(dimension),
      subject: dimension,
      summary: `来源含${dimension}信息；具体事实须结合出行日期和走走地点知识复核。`,
      level: 'candidate',
      evidenceLocator,
    })),
    permission: 'unknown',
    research: {
      batch: 'first-20-cities-review-v1',
      readLevel: record.evidence_mode?.includes('subtitle') ? 'video-subtitle' : 'video-description',
      bodyCharacters: text.length,
      evidence: (record.evidence_refs ?? []).filter(ref => ref.locator).slice(0, 1).map(ref => ({
        term: record.city,
        field: 'evidence_refs.paraphrase',
        locator: ref.locator!,
      })),
    },
  }
}

export function reviewRecord(record: SourceRecord): { review: ReviewedRecord; guide: GuideCandidate | null } {
  const text = evidenceText(record)
  const matches = matchedKnowledge(record)
  const common = {
    recordId: record.record_id, city: record.city, platform: record.platform, sourceUrl: record.source_url,
    matchedPlaces: matches.places, matchedFoods: matches.foods, matchedHotels: matches.hotels,
    evidenceCharacters: text.length,
  }
  if (!['bilibili', 'douyin', 'xiaohongshu'].includes(record.platform)) {
    return { review: { ...common, decision: 'hold', reason: 'unsupported_platform', score: 0 }, guide: null }
  }
  if (hasWrongCitySignal(record)) {
    return { review: { ...common, decision: 'hold', reason: 'wrong_city', score: 0 }, guide: null }
  }
  const detail = detailSignals(record, text)
  const matchCount = matches.places.length + matches.foods.length + matches.hotels.length
  const score = Math.min(100, (text.length >= 120 ? 12 : text.length >= 70 ? 5 : 0)
    + Math.min(42, matchCount * 9) + Math.min(18, detail.structured * 4)
    + Math.min(16, detail.enumerated * 3) + Math.min(12, detail.practical * 2))
  if (text.length < 70 || (detail.structured === 0 && detail.enumerated === 0 && detail.practical < 2)) {
    return { review: { ...common, decision: 'hold', reason: 'insufficient_detail', score }, guide: null }
  }
  if (matchCount === 0) {
    const dimensions = adviceDimensions(record)
    // Structured source fields already passed the batch evidence audit.  Three
    // independent planning dimensions plus concrete execution language are
    // enough for an advice card even when the place dictionary has no match.
    // These cards never emit place hints or factual claims.
    if (text.length >= 120 && detail.structured >= 2 && detail.practical >= 2 && dimensions.length >= 2) {
      return { review: { ...common, decision: 'runtime_candidate', reason: 'usable', score }, guide: adviceGuide(record, text, dimensions) }
    }
    return { review: { ...common, decision: 'hold', reason: 'no_concrete_match', score }, guide: null }
  }
  const runtimePlaces = matches.places.slice(0, 8)
  const runtimeFoods = matches.foods.slice(0, 8)
  const runtimeHotels = matches.hotels.slice(0, 4)
  const route = runtimePlaces.length >= 2 ? `正文顺序涉及：${runtimePlaces.join(' → ')}` : null
  const activities = unique([
    /亲子|带娃/.test(text) ? '亲子' : '', /city\s*walk|城市漫步/i.test(text) ? 'City Walk' : '',
    /拍照|机位/.test(text) ? '拍照' : '', /夜景|夜游/.test(text) ? '夜游' : '',
    /徒步|爬山/.test(text) ? '徒步' : '', /早市/.test(text) ? '早市' : '', /夜市/.test(text) ? '夜市' : '',
  ].filter(Boolean))
  const summaryParts = [
    runtimePlaces.length ? `具体地点：${runtimePlaces.join('、')}` : '',
    runtimeFoods.length ? `餐饮线索：${runtimeFoods.join('、')}` : '',
    runtimeHotels.length ? `住宿线索：${runtimeHotels.join('、')}` : '',
    route ?? '',
  ].filter(Boolean)
  const claims: GuideCandidate['claims'] = [
    ...runtimePlaces.slice(0, 4).map(placeName => ({ type: 'place' as const, text: `来源正文提到${placeName}`, placeName, confidence: 0.72, verified: false })),
    ...runtimeFoods.slice(0, 3).map(food => ({ type: 'food' as const, text: `来源正文提到${food}`, confidence: 0.68, verified: false })),
    ...(route ? [{ type: 'route' as const, text: route, confidence: 0.62, verified: false }] : []),
  ]
  const platform = record.platform as GuidePlatform
  const guide: GuideCandidate = {
    id: `reviewed20-${record.record_id}`,
    city: record.city,
    platform,
    sourceUrl: record.source_url,
    title: compact(record.source_title).slice(0, 80),
    author: compact(record.author ?? '来源作者'),
    publishedAt: record.published_at ?? null,
    fetchedAt: record.observed_at ?? new Date(0).toISOString(),
    likes: null,
    summary: `${summaryParts.join('；')}。社区来源仅用于候选排序，营业、票务、价格和实际转场需按出行日期核验。`,
    tags: unique([...(record.scenario ?? []).map(compact), ...activities]).slice(0, 5),
    placeHints: runtimePlaces,
    foodHints: runtimeFoods,
    localExperienceHints: activities,
    hotelHints: matches.hotels.length ? ['正文提到具体住宿'] : [],
    hotelNames: runtimeHotels,
    dietaryTags: [],
    claims,
    permission: 'unknown',
    research: {
      batch: 'first-20-cities-review-v1',
      readLevel: record.evidence_mode?.includes('subtitle') ? 'video-subtitle' : 'video-description',
      bodyCharacters: text.length,
      evidence: (record.evidence_refs ?? []).filter(ref => ref.locator && ref.paraphrase).slice(0, 1).map(ref => ({
        term: unique([...runtimePlaces, ...runtimeFoods, ...runtimeHotels]).find(term => (ref.paraphrase ?? '').includes(term)) ?? record.city,
        field: 'evidence_refs.paraphrase',
        locator: ref.locator!,
      })),
    },
  }
  return { review: { ...common, decision: 'runtime_candidate', reason: 'usable', score }, guide }
}

function acceptedRecordIds(batch: number) {
  const review = parseJsonFile<{ accepted_record_ids?: string[] }>(resolve(ROOT, `runs/batch-${String(batch).padStart(3, '0')}/dedup-review.json`))
  return new Set(review.accepted_record_ids ?? [])
}

function batchCities(batch: number) {
  const checkpoint = parseJsonFile<{ cities?: string[] }>(resolve(ROOT, `runs/batch-${String(batch).padStart(3, '0')}/checkpoint.json`))
  return checkpoint.cities ?? []
}

function loadBatch(batch: number) {
  const accepted = acceptedRecordIds(batch)
  const cities = batchCities(batch)
  const candidates = new Map<string, SourceRecord[]>()
  for (const city of cities) {
    const directory = resolve(ROOT, 'records', city)
    for (const name of readdirSync(directory)) {
      if (!name.endsWith('.json')) continue
      const record = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as SourceRecord
      const overlayPath = resolve(ROOT, 'second-pass', 'bilibili', `${record.record_id}.json`)
      if (existsSync(overlayPath)) {
        const overlay = JSON.parse(readFileSync(overlayPath, 'utf8')) as { description?: string; subtitle_text?: string; subtitle_locator?: string; status?: string }
        const overlayText = compact(`${overlay.description ?? ''} ${overlay.subtitle_text ?? ''}`)
        if (['description_candidate', 'usable_description'].includes(overlay.status ?? '') && overlayText.length >= 70) {
          record.evidence_refs = [...(record.evidence_refs ?? []), {
            locator: overlay.subtitle_text ? overlay.subtitle_locator ?? 'Bilibili public subtitle' : 'Bilibili public API description',
            paraphrase: overlayText,
          }]
          record.evidence_mode = overlay.subtitle_text ? 'public-subtitle-second-pass' : 'public-description-second-pass'
        }
      }
      if (accepted.has(record.record_id) && record.city === city && record.review_status === 'reviewed_candidate') {
        const values = candidates.get(record.record_id) ?? []
        values.push(record)
        candidates.set(record.record_id, values)
      }
    }
  }
  const records = [...candidates.values()].map(values => {
    const selected = [...values].sort((left, right) => assignmentScore(right) - assignmentScore(left))[0]
    const destination = inferredDestination(selected)
    return cities.includes(destination) ? { ...selected, city: destination } : selected
  })
  return { cities, records }
}

export function buildReviewedRelease(now = new Date()) {
  const all = BATCHES.map(loadBatch)
  const cities = unique(all.flatMap(batch => batch.cities))
  const incomplete = BATCHES.flatMap(batch => {
    const resultPath = resolve(ROOT, `runs/batch-${String(batch).padStart(3, '0')}/city-results.json`)
    const result = JSON.parse(readFileSync(resultPath, 'utf8')) as { cities?: Array<{ city: string; valid_records: number }> }
    return (result.cities ?? []).filter(city => city.valid_records < 200)
      .map(city => ({ batch, city: city.city, validRecords: city.valid_records }))
  })
  if (cities.length !== 60 || incomplete.length > 0) {
    throw new Error(`60-city runtime release blocked: cities=${cities.length}, incomplete=${JSON.stringify(incomplete)}`)
  }
  const recordsById = new Map<string, SourceRecord[]>()
  for (const record of all.flatMap(batch => batch.records)) {
    recordsById.set(record.record_id, [...(recordsById.get(record.record_id) ?? []), record])
  }
  const records = [...recordsById.values()].map(values => [...values]
    .sort((left, right) => assignmentScore(right) - assignmentScore(left))[0])
  const reviewed = records.map(reviewRecord)
  const selected: GuideCandidate[] = []
  for (const city of cities) {
    const ranked = reviewed.filter(item => item.guide?.city === city)
      .sort((left, right) => right.review.score - left.review.score || right.review.evidenceCharacters - left.review.evidenceCharacters)
    // Every candidate that passed the same semantic and provenance gate remains
    // searchable. Per-request ranking below keeps prompt size bounded.
    selected.push(...ranked.flatMap(item => item.guide ? [item.guide] : []))
  }
  const generatedAt = now.toISOString()
  const knowledgeBase: GuideKnowledgeBase = { version: 1, generatedAt, guides: selected }
  const reasonCounts = Object.fromEntries(unique(reviewed.map(item => item.review.reason)).map(reason => [reason, reviewed.filter(item => item.review.reason === reason).length]))
  const perCity = Object.fromEntries(cities.map(city => {
    const cityReviews = reviewed.filter(item => item.review.city === city)
    return [city, {
      reviewed: cityReviews.length,
      runtimeCandidates: cityReviews.filter(item => item.review.decision === 'runtime_candidate').length,
      runtimeSelected: selected.filter(guide => guide.city === city).length,
      matchedPlaceSignals: unique(cityReviews.flatMap(item => item.review.matchedPlaces)).length,
      matchedFoodSignals: unique(cityReviews.flatMap(item => item.review.matchedFoods)).length,
      matchedHotelSignals: unique(cityReviews.flatMap(item => item.review.matchedHotels)).length,
    }]
  }))
  const report = {
    schemaVersion: 1,
    generatedAt,
    scope: { batches: [...BATCHES], cities, acceptedInputRecords: records.length, platforms: ['bilibili', 'douyin', 'xiaohongshu'] },
    result: { reviewed: reviewed.length, runtimeCandidates: reviewed.filter(item => item.guide).length, runtimeSelected: selected.length, held: reviewed.filter(item => !item.guide).length, reasons: reasonCounts },
    perCity,
    boundaries: [
      '逐条审查覆盖批次 accepted_record_ids；全部通过语义门的候选进入运行时检索，每次生成再按城市、需求和证据强度限量召回。',
      '社区来源只影响候选与偏好排序；动态价格、营业、预约、库存和实际转场保持未核验。',
      'rights_status=private-analysis-only 的原文不复制到运行时，只保留短摘要、来源链接和证据定位。',
    ],
    reviews: reviewed.map(item => item.review),
  }
  const digest = createHash('sha256').update(JSON.stringify(knowledgeBase)).digest('hex')
  return { knowledgeBase, report: { ...report, outputSha256: digest } }
}

export function writeReviewedRelease(now = new Date()) {
  const { knowledgeBase, report } = buildReviewedRelease(now)
  writeFileSync(OUTPUT, `${JSON.stringify(knowledgeBase, null, 2)}\n`, 'utf8')
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { knowledgeBase, report }
}

function main() {
  const { report } = writeReviewedRelease()
  console.log(JSON.stringify({ output: OUTPUT, report: REPORT, ...report.result, cities: report.scope.cities.length }, null, 2))
}

const entry = process.argv[1] ? resolve(process.argv[1]) : ''
if (entry && fileURLToPath(import.meta.url) === entry) main()

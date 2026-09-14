import { describe, it, expect } from 'vitest'
import { understandTrip, generatePlans, getReplacementCandidates, isHotelStop, replacePlanPlace } from './planner'
import { searchGuideCandidates, type GuideCandidate } from './guides'
import { factsFor, isOfficiallyClosed } from './verifiedFacts'
import { buildTravelGuide } from './guide'
import { getCityRouteZone } from './cityRouteSpecs'
import { getCityKnowledge, isConcreteKnowledgeItem } from './cityKnowledge'
import { getLocalGuideContext } from './localGuides'
import { searchTravelGuides } from '../../../server/travel-guides'
import restaurantResearch from '../../../data/travel-research/2026-09-06-restaurants.json'
import { restaurantSourcesFor } from './researched-place-specs'

const intentFor = (text: string) => understandTrip({text, media: []}).intent
const source = (id: string, read = false): GuideCandidate => ({
  id, city: '兰州', platform: 'bilibili', sourceUrl: `https://www.bilibili.com/video/${id}`,
  title: '兰州旅行', author: '测试', publishedAt: null, fetchedAt: '2026-09-06', likes: read ? 1 : 1000000,
  summary: '兰州博物馆参观', tags: [], placeHints: ['甘肃省博物馆'], claims: [], permission: 'unknown',
  research: {batch: 'test', readLevel: read ? 'video-subtitle' : 'search-metadata', bodyCharacters: read ? 100 : 0,
    evidence: read ? [{term: '甘肃省博物馆', field: 'subtitle', locator: '00:20'}] : []},
})

describe('travel knowledge quality and request parity', () => {
  it('resolves one requested crab dish to one same-city branch and offers another branch', () => {
    for (const dish of ['红膏呛蟹', '红膏炝蟹']) {
      const intent = intentFor(`宁波三天，想吃${dish}，预算4000。`)
      expect(intent.mustVisit).toContain('红膏呛蟹')
      expect(intent.mustVisit.some(name => name.includes('状元楼'))).toBe(false)
      const plan = generatePlans(intent)[0]
      const stop = Object.values(plan.days).flat().find(stop => stop.name === '宁波状元楼酒店（和义路店）')!
      expect(stop).toBeDefined()
      expect(isHotelStop(stop)).toBe(false)
      expect(stop.address).toContain('宁波市')
      expect(stop.priceState).toBe('unknown')
      // Daily meals can revisit a venue, but must not add every branch as a new requested stop.
      expect(new Set(Object.values(plan.days).flat().filter(stop => stop.name.includes('状元楼')).map(stop => stop.name)).size).toBe(1)
      expect(getReplacementCandidates(plan, stop.id).some(candidate => candidate.name === '宁波状元楼酒店（东部新城店）')).toBe(true)
      const changed = replacePlanPlace(plan, stop.id, '宁波状元楼酒店（东部新城店）')
      expect(changed.validation.issues.some(issue => issue.includes('缺少必去地点'))).toBe(false)
      expect(buildTravelGuide(plan).sections.flatMap(section => section.sources)).toContain('https://www.ihningbo.cn/directory/show/105')
    }
    expect(intentFor('杭州三天，想吃红膏呛蟹。').mustVisit.some(name => name.includes('宁波状元楼'))).toBe(false)
    expect(intentFor('宁波三天，不想吃红膏呛蟹。').mustVisit.some(name => name.includes('状元楼'))).toBe(false)
    const unmet = generatePlans(intentFor('宜昌一天，想吃白刹肥鱼，预算2000。'))[0]
    expect(unmet.intent.mustVisit).toContain('白刹肥鱼')
    expect(unmet.validation.issues.some(issue => issue.includes('白刹肥鱼'))).toBe(true)
  })
  it('keeps researched restaurant branches, dish evidence and city boundaries intact', () => {
    expect(new Set(restaurantResearch.restaurants.map(item => item.city)).size).toBe(20)
    for (const restaurant of restaurantResearch.restaurants) {
      const item = getCityKnowledge(restaurant.city).items.find(item => item.name === restaurant.name)!
      expect(item.venueName).toBe(restaurant.name)
      expect(item.address).toContain(restaurant.city)
      expect(item.menuHighlights).toEqual(restaurant.menu)
      expect(item.coordinates).toBeUndefined()
      expect(item.price.state).toBe('unknown')
      expect(restaurant.sources.some(source => source.fields.includes('menu'))).toBe(true)
      expect(restaurantSourcesFor('不存在的城市', restaurant.name)).toEqual([])
    }
  })
  it('keeps a positive requirement when a different museum is unavailable', () => {
    const intent = intentFor('南京三天，南京博物院没有预约到，但想去江苏省美术馆。')
    expect(intent.unavailablePlaces).toContain('南京博物院')
    expect(intent.unavailablePlaces).not.toContain('江苏省美术馆')
    expect(intent.mustVisit).not.toContain('南京博物院')
    expect(intent.mustVisit).toContain('江苏省美术馆')
  })
  it('excludes an explicitly rejected attraction from every plan', () => {
    const intent = intentFor('上海三天，不去外滩，想去武康路，预算4000。')
    expect(intent.mustVisit).not.toContain('外滩')
    expect(intent.unavailablePlaces).toContain('外滩')
    for (const plan of generatePlans(intent)) expect(Object.values(plan.days).flat().map(stop => stop.name)).not.toContain('外滩')
  })
  it('keeps explicit negative lists out of requirements and exports constrained choices', () => {
    const intent = intentFor('上海两天，不去外滩和豫园，想去武康路，预算3000。')
    expect(intent.unavailablePlaces).toEqual(expect.arrayContaining(['外滩', '豫园']))
    expect(intent.mustVisit).not.toContain('豫园')
    const guide = buildTravelGuide(generatePlans(intent)[0])
    expect(guide.sections[0].lines.some(line => line.includes('用户排除或不可用'))).toBe(true)
    expect(guide.sections[14].lines.some(line => line.includes('可选：'))).toBe(true)
  })
  it('does not interpret an unavailable mention as rejection of every mentioned place', () => {
    const intent = intentFor('南京三天，南京博物院无票，老门东想去。')
    expect(intent.unavailablePlaces).not.toContain('老门东')
  })
  it('prefers readable evidence over popularity without claiming verified facts', () => {
    const candidate = searchGuideCandidates({version: 1, generatedAt: '', guides: [source('popular'), source('read', true)]}, '兰州').candidates[0]
    expect(candidate.id).toBe('read')
    expect(candidate.claims.some(claim => claim.verified)).toBe(false)
  })
  it('matches place names inside a full Chinese sentence and deduplicates source URLs', () => {
    const original = source('read', true)
    const result = searchGuideCandidates({version: 1, generatedAt: '', guides: [original, {...original, id: 'duplicate', sourceUrl: original.sourceUrl + '?share=1'}]}, '兰州', '我想带父母参观甘肃省博物馆然后吃饭')
    expect(result.matchedTerms).toContain('甘肃省博物馆')
    expect(result.candidates).toHaveLength(1)
  })
  it('returns the same ranked source IDs on local and server paths', () => {
    const query = '宁波三天想了解本地人生活和住宿'
    expect(searchTravelGuides('宁波', query).candidates.map(item => item.id)).toEqual(getLocalGuideContext('宁波', query).candidates.map(item => item.id))
  })
  it('offers more alternatives without repeating scheduled places or showing unknown prices as zero', () => {
    const plan = generatePlans(intentFor('南昌一天，预算2000。'))[0]
    const stop = Object.values(plan.days).flat().find(item => !isHotelStop(item) && !item.type.includes('餐'))!
    const candidates = getReplacementCandidates(plan, stop.id)
    expect(candidates.length).toBeGreaterThan(3)
    const names = new Set(Object.values(plan.days).flat().map(item => item.name))
    expect(candidates.every(item => !names.has(item.name))).toBe(true)
    const meal = Object.values(plan.days).flat().find(item => item.type.includes('餐'))!
    const mealCandidates = getReplacementCandidates(plan, meal.id)
    const unknown = mealCandidates.filter(candidate => plan.knowledge.items.find(item => item.name === candidate.name)?.price.state === 'unknown')
    expect(unknown.length).toBeGreaterThan(0)
    expect(unknown.every(item => item.meta.includes('费用待确认') && !item.meta.includes('¥0'))).toBe(true)
  })
  it('keeps conflicting ticket information separate from verified address and admission', () => {
    expect(factsFor('郑州', '河南博物院').some(fact => fact.field === 'booking' && fact.state === 'conflict')).toBe(true)
    expect(factsFor('郑州', '河南博物院').find(fact => fact.field === 'address')?.state).toBe('verified')
    expect(factsFor('合肥', '安徽博物院').find(fact => fact.field === 'booking')?.state).toBe('unknown')
  })
  it('enforces official date-bounded closure without extrapolating reopening', () => {
    expect(isOfficiallyClosed('成都', '金沙遗址博物馆', {start: '2026-09-10', end: '2026-09-12'})).toBe(true)
    expect(isOfficiallyClosed('成都', '金沙遗址博物馆', {start: '2027-05-02', end: '2027-05-03'})).toBe(false)
    const intent = intentFor('2026年9月10日到9月12日去成都三天，想去金沙遗址博物馆，预算3000。')
    for (const plan of generatePlans(intent)) expect(Object.values(plan.days).flat().some(stop => stop.name.includes('金沙遗址'))).toBe(false)
  })
  it('honors relaxed pace and a requested hotel area while keeping optional remote trips out', () => {
    const intent = intentFor('宁波三天，节奏轻松，住在天一广场附近，想去包玉刚故居，预算4000。')
    expect(intent.hotel).toBe('天一广场附近')
    expect(intent.missing).not.toContain('酒店位置')
    for (const plan of generatePlans(intent)) {
      const stops = Object.values(plan.days).flat()
      expect(stops.some(stop => stop.name === '包玉刚故居')).toBe(true)
      expect(stops.some(stop => stop.name === '象山影视城')).toBe(false)
      for (const stop of stops.filter(stop => /寺|博物馆/.test(stop.name) && !stop.opening)) {
        const [hours, minutes] = stop.time.split(':').map(Number)
        expect(hours * 60 + minutes + stop.durationMinutes).toBeLessThanOrEqual(18 * 60)
      }
    }
    expect(getCityRouteZone('宁波', '包玉刚故居', '镇海区 / 后包巷').name).toBe('镇海人物文化线')
    const explicit = generatePlans(intentFor('宁波三天，节奏轻松，想去象山影视城，预算4000。'))
    expect(explicit.some(plan => Object.values(plan.days).flat().some(stop => stop.name === '象山影视城'))).toBe(true)
  })
  it('keeps cuisine names as hints rather than fabricated venues and filters their dietary risks', () => {
    const item = getCityKnowledge('宁波').items.find(item => item.name === '红膏呛蟹')!
    expect(item.venueName).toBeUndefined()
    expect(isConcreteKnowledgeItem(item)).toBe(false)
    const plan = generatePlans(intentFor('宁波三天，素食，预算4000。'))[0]
    expect(Object.values(plan.days).flat().some(stop => stop.name === '红膏呛蟹')).toBe(false)
    const guide = buildTravelGuide(plan)
    expect(guide.sections[6].lines.join(' ')).not.toContain('红膏呛蟹')
  })
  it('adds a traceable cultural alternative without fabricated coordinates', () => {
    const item = getCityKnowledge('宁波').items.find(item => item.name === '包玉刚故居')
    expect(item?.source.kind).toBe('official')
    expect(item?.coordinates).toBeUndefined()
    expect(factsFor('宁波', '包玉刚故居').length).toBe(4)
  })
})

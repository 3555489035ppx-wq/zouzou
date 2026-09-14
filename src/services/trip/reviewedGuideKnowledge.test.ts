import { describe, expect, it } from 'vitest'
import reviewed from '../../../data/travel-guides-reviewed-20-cities.json'
import reviewReport from '../../../docs/qa/three-platform-first-20-city-review.json'
import namedPlaces from '../../../data/travel-research/three-platform-named-places.json'
import { getLocalGuideContext } from './localGuides'
import { getCityKnowledge } from './cityKnowledge'
import { factsFor } from './verifiedFacts'
import { generatePlans, understandTrip } from './planner'
import { reviewRecord, type SourceRecord } from '../../../scripts/build-reviewed-three-platform-guides'

describe('reviewed 60-city community knowledge', () => {
  it('matches concrete places from reviewed structured fields instead of reading only short evidence refs', () => {
    const record = {
      record_id: 'structured-fields-example', platform: 'bilibili', source_url: 'https://www.bilibili.com/video/example',
      source_title: '上海城市漫步攻略', city: '上海', review_status: 'reviewed_candidate',
      evidence_refs: [{ locator: 'subtitle 0s-20s', paraphrase: '上午从地铁站出发，步行串联沿江建筑，中午就近用餐，下午继续同片区路线，返程前留出交通时间。' }],
      poi_sequences: [{ sequence: ['外白渡桥', '北外滩', '步行前往下一站并预留返程时间'] }],
    } satisfies SourceRecord
    expect(reviewRecord(record).review.matchedPlaces).toContain('外白渡桥—北外滩')
    expect(reviewRecord(record).review.decision).toBe('runtime_candidate')
  })

  it('keeps detailed multi-dimensional advice without inventing a place', () => {
    const record = {
      record_id: 'advice-only-example', platform: 'douyin', source_url: 'https://www.douyin.com/video/example',
      source_title: '上海三天两晚分区旅行建议', city: '上海', review_status: 'reviewed_candidate',
      evidence_refs: [{ locator: 'caption', paraphrase: '第一天按片区步行，早餐午餐分开安排；下雨时改用室内备选，返程前预留交通时间。抵达后先寄存行李，不临时跨区；晚餐结束后乘地铁返回住宿片区。第二天上午安排文化体验，中午休息，下午根据天气和同行人体力调整。' }],
      day_patterns: ['第一天上午与下午分开，第二天保留休息时间'], area_combinations: ['同片区串联，减少折返和临时长距离转场'],
      meal_patterns: ['早餐和午餐分别安排，晚餐回住宿片区解决'], stay_area_advice: ['住宿靠近公共交通和返程方向'],
      pitfalls: ['返程前预留时间，不把未核验营业时间当成保证'], plan_b: ['下雨改用室内备选并乘地铁转场'],
    } satisfies SourceRecord
    const result = reviewRecord(record)
    expect(result.review.decision).toBe('runtime_candidate')
    expect(result.guide?.placeHints).toEqual([])
    expect(result.guide?.claims).toEqual([])
    expect(result.guide?.summary).toContain('具体地点仍由走走现有知识库提供')
    expect(result.guide?.experiences?.map(experience => experience.subject)).toContain('备选方案')
  })

  it('holds a departure-city record whose actual itinerary is in another city', () => {
    const record = {
      record_id: 'wrong-city-example', platform: 'douyin', source_url: 'https://www.douyin.com/video/example',
      source_title: '长沙到昆明一日游', city: '长沙', review_status: 'reviewed_candidate',
      evidence_refs: [{ locator: 'caption', paraphrase: '长沙到昆明一日游，翠湖公园、昆明老街、黄公东街，#昆明旅游 #昆明一日游' }],
    } satisfies SourceRecord
    expect(reviewRecord(record).review.reason).toBe('wrong_city')
    expect(reviewRecord(record).guide).toBeNull()
  })

  it('publishes evidence-backed candidates for every scoped city', () => {
    const cities = ['上海', '杭州', '苏州', '南京', '成都', '厦门', '北京', '广州', '重庆', '西安', '深圳', '长沙', '青岛', '武汉', '昆明', '三亚', '桂林', '哈尔滨', '贵阳', '张家界', '康定', '稻城亚丁', '九寨沟', '大理', '丽江', '香格里拉', '西双版纳', '腾冲', '沈阳', '大连', '长春', '延吉', '漠河', '温州', '台州', '丽水', '乌鲁木齐', '喀什', '拉萨', '林芝', '天津', '济南', '福州', '宁波', '无锡', '合肥', '南昌', '郑州', '洛阳', '兰州', '西宁', '海口', '珠海', '泉州', '银川', '呼和浩特', '太原', '南宁', '宜昌', '威海']
    expect(new Set(reviewed.guides.map(guide => guide.city))).toEqual(new Set(cities))
    expect(reviewed.guides.every(guide => guide.research.bodyCharacters >= 70 && guide.research.evidence.length > 0)).toBe(true)
    expect(reviewed.guides.every(guide => guide.claims.every(claim => claim.verified === false))).toBe(true)
    expect(reviewed.guides).toHaveLength(reviewReport.result.runtimeCandidates)
    expect(reviewReport.result.runtimeSelected).toBe(reviewReport.result.runtimeCandidates)
  })

  it('makes reviewed route order and experience evidence visible in a generated itinerary', () => {
    const query = '上海3天2晚，想走安福路、外滩和北外滩，喜欢咖啡和本地小吃，下雨要有室内备选，不想太赶'
    const context = getLocalGuideContext('上海', query)
    const intent = understandTrip({ text: query, media: [] }).intent
    expect(intent.mustVisit).toContain('外白渡桥—北外滩')
    const plan = generatePlans(intent, context)[0]
    const stops = Object.values(plan.days).flat().map(stop => stop.name)
    expect(context.candidates).toHaveLength(8)
    expect(stops).toContain('安福路')
    expect(stops).toContain('外白渡桥—北外滩')
    expect(plan.evidence.some(line => line.includes('8 条公开攻略证据'))).toBe(true)
    expect(plan.evidence.some(line => line.startsWith('攻略经验候选：'))).toBe(true)
  })

  it('does not expand a shared endpoint or an excluded endpoint into a required composite route', () => {
    expect(understandTrip({text:'上海3天，只去外滩。',media:[]}).intent.mustVisit).not.toContain('外白渡桥—北外滩')
    expect(understandTrip({text:'上海3天，想去北外滩，不去外白渡桥。',media:[]}).intent.mustVisit).not.toContain('外白渡桥—北外滩')
  })

  it('lets deeply read community evidence take part in destination matching', () => {
    const context = getLocalGuideContext('三亚', '三亚亲子游，想住亚龙湾并安排海边活动')
    expect(context.candidates.some(candidate => candidate.id.startsWith('reviewed20-'))).toBe(true)
    expect(context.candidates.some(candidate => candidate.research?.bodyCharacters && candidate.research.bodyCharacters >= 70)).toBe(true)
  })

  it('keeps Datong source knowledge out of the local browser context', () => {
    expect(getLocalGuideContext('大同', '云冈石窟 悬空寺').candidates).toEqual([])
    expect(getCityKnowledge('大同').status).toBe('fallback')
    expect(getCityKnowledge('大同').items.some(item => item.name === '云冈石窟')).toBe(false)
    expect(factsFor('大同', '云冈石窟')).toEqual([])
  })

  it('turns the reviewed Yangpu riverside sequence into an executable, map-safe plan stop', () => {
    const route = getCityKnowledge('上海').items.find(item => item.name === '杨浦滨江工业遗产步行段')
    expect(route).toMatchObject({ venueName: '杨浦滨江', durationMinutes: 210, verified: false })
    expect(route?.coordinates).toBeUndefined()

    const intent = understandTrip({ text: '上海1日游，必须去杨浦滨江工业遗产步行段', media: [] }).intent
    const plans = generatePlans(intent)
    const routeStops = plans.map(plan => Object.values(plan.days).flat().find(stop => stop.name === route?.name))
    expect(routeStops.every(Boolean)).toBe(true)
    expect(routeStops.every(stop => stop?.note.includes('世界技能博物馆'))).toBe(true)
    expect(routeStops.every(stop => stop?.transport.includes('实际路线请查看地图'))).toBe(true)
  })

  it('publishes title-backed named places as unverified map candidates', () => {
    const candidate = namedPlaces.entries.find(entry => entry.name === '四湾菜市场') ?? namedPlaces.entries[0]
    expect(candidate).toBeDefined()
    const place = getCityKnowledge(candidate.city).items.find(item => item.name === candidate.name)
    expect(place).toMatchObject({ category: 'attraction', verified: false })
    expect(place?.coordinates).toBeUndefined()
    expect(place?.summary).toContain('具体位置')
  })

  it('keeps a formal lunch inside a long must-visit day before an early return', () => {
    const query = '张家界3天2晚，2026年10月12日到10月14日，两人，总预算6000元，09:00到达张家界站，最后一天18:00从张家界站返程，武陵源、天门山和徒步路线'
    const intent = understandTrip({ text: query, media: [] }).intent
    const plan = generatePlans(intent, getLocalGuideContext('张家界', query))[0]
    const lastDay = plan.days['Day 3']
    expect(lastDay.some(stop => stop.type === '午餐')).toBe(true)
    const lunch = lastDay.find(stop => stop.type === '午餐')
    expect(lunch).toMatchObject({ pendingVenue: true })
    expect(lunch?.durationMinutes).toBeGreaterThanOrEqual(45)
    expect(lunch?.durationMinutes).toBeLessThanOrEqual(75)
    expect(Object.values(plan.days).flat().some(stop => stop.name.includes('武陵源'))).toBe(true)
    expect(Object.values(plan.days).flat().some(stop => stop.name.includes('天门山'))).toBe(true)
    expect(plan.validation.passed).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHANGHAI_PROMPT,
  generatePlans,
  replacePlanPlace,
  understandTrip,
} from './planner'
import type { GuideContext } from './guides'
import { cityNames, getCityProfile } from '../../demo-data/cities'

describe('Shanghai itinerary planner', () => {
  it('extracts the complete demo trip instead of returning fixed values', () => {
    const result = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })

    expect(result.intent.destination).toBe('上海')
    expect(result.intent.dates).toEqual({ start: '2026-09-18', end: '2026-09-20' })
    expect(result.intent.arrivalTime).toBe('10:30')
    expect(result.intent.departureTime).toBe('18:30')
    expect(result.intent.budget).toBe(4000)
    expect(result.intent.partySize).toBe(2)
    expect(result.intent.pace).toBe('relaxed')
    expect(result.intent.mustVisit).toEqual(expect.arrayContaining(['武康路', '安福路', '展览', '外滩']))
    expect(result.intent.missing).toEqual([])
  })

  it('flags missing anchors before claiming a trip is executable', () => {
    const result = understandTrip({ text: '我想去上海三天，预算 2000，想看展和喝咖啡。', media: [] })

    expect(result.intent.missing).toEqual(expect.arrayContaining(['具体出行日期', '到达时间和地点', '返程时间和地点', '酒店位置']))
  })

  it('uses only confirmed screenshot facts as scheduling anchors', () => {
    const result = understandTrip({
      text: '我想去上海三天，住在静安寺附近。',
      media: [{ id: 'ticket-1', src: 'data:image/png;base64,AA==', name: '车票.png' }],
      mediaFacts: [{
        mediaId: 'ticket-1',
        name: '车票.png',
        kind: 'ticket',
        rawText: '2026年9月18日 10:30 虹桥火车站',
        facts: {
          dates: { start: '2026-09-18', end: '2026-09-20' },
          times: ['10:30'],
          locations: ['虹桥火车站'],
          arrivalLocation: '虹桥火车站',
          departureLocation: null,
          hotel: null,
          placeNames: [],
          budget: null,
          notes: [],
        },
        confidence: 0.95,
        needsConfirmation: false,
        warnings: [],
        provider: 'zhipu',
      }],
    })

    expect(result.intent.dates).toEqual({ start: '2026-09-18', end: '2026-09-20' })
    expect(result.intent.arrivalTime).toBe('10:30')
    expect(result.intent.arrivalLocation).toBe('虹桥火车站')
    expect(result.intent.missing).toContain('返程时间和地点')
  })

  it('creates three variants that pass deterministic schedule checks', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })
    const generated = generatePlans(understanding.intent)

    expect(generated).toHaveLength(3)
    expect(generated.every((plan) => plan.validation.passed)).toBe(true)
    expect(generated[0].days['Day 1'].map((stop) => stop.name)).toContain('武康路')
    expect(generated[0].days['Day 2'].find((stop) => stop.name === '上海博物馆东馆')?.opening?.from).toBe('10:00')
    expect(generated.every((plan) => plan.budget <= 4000)).toBe(true)
  })

  it('replaces one stop while preserving the rest of the route', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })
    const original = generatePlans(understanding.intent)[0]
    const updated = replacePlanPlace(original, 'wukang-cafe', '衡山和集')

    expect(updated.days['Day 1'].find((stop) => stop.id === 'wukang-cafe')?.name).toBe('衡山和集')
    expect(updated.days['Day 1'].find((stop) => stop.id === 'wukang-road')?.name).toBe('武康路')
    expect(updated.validation.passed).toBe(true)
  })

  it('carries guide context into plan evidence and adapts the city skeleton', () => {
    const understanding = understandTrip({ text: '我想去杭州三天，两个人，预算 3000 元。', media: [] })
    const guideContext: GuideContext = {
      city: '杭州',
      candidates: [
        {
          id: 'guide-hangzhou-1',
          city: '杭州',
          platform: 'xiaohongshu',
          sourceUrl: 'https://www.xiaohongshu.com/explore/example',
          title: '杭州西湖 City Walk 攻略',
          author: '测试作者',
          publishedAt: null,
          fetchedAt: '2026-08-29T00:00:00.000Z',
          likes: 100,
          summary: '杭州旅行攻略线索；主题：City Walk；地点：西湖。',
          tags: ['City Walk'],
          placeHints: ['西湖'],
          claims: [],
          permission: 'unknown',
        },
      ],
      matchedTerms: ['旅行攻略'],
      generatedAt: '2026-08-29T00:00:00.000Z',
      disclaimer: '仅作社区体验参考。',
    }
    const generated = generatePlans(understanding.intent, guideContext)

    expect(generated[0].city).toBe('杭州')
    expect(generated[0].guideContext?.candidates.length).toBe(1)
    expect(generated[0].evidence.some((item) => item.includes('小红书社区攻略线索'))).toBe(true)
    expect(Object.values(generated[0].days).flat().some((stop) => stop.name.includes('武康路'))).toBe(false)
    expect(Object.values(generated[0].days).flat().some((stop) => stop.name.includes('西湖'))).toBe(true)
  })

  it('generates a complete three-day timeline for every supported city', () => {
    for (const city of cityNames) {
      const firstPlace = getCityProfile(city).demoLabels[0]
      const understanding = understandTrip({
        text: `2026年9月18日到9月20日去${city}，3天2晚，2个人，预算4000元。10:30到${city}东站，住${city}中心酒店，18:30从${city}东站返程。想去${firstPlace}，行程不要太赶。`,
        media: [],
      })
      const plan = generatePlans(understanding.intent)[0]
      const allStops = Object.values(plan.days).flat()

      expect(understanding.intent.destination).toBe(city)
      expect(understanding.intent.missing).toEqual([])
      expect(Object.keys(plan.days)).toEqual(['Day 1', 'Day 2', 'Day 3'])
      expect(allStops.length).toBeGreaterThanOrEqual(16)
      expect(allStops.some((stop) => stop.name.includes(firstPlace))).toBe(true)
      expect(allStops.every((stop) => stop.name && stop.time && stop.transport)).toBe(true)
    }
  })

  it('turns structured Changsha needs into a sourced food, hotel and attraction plan', () => {
    const understanding = understandTrip({
      text: '2026年9月18日到9月20日去长沙3天2晚。两个人，预算3000元（含住宿、市内交通、餐饮和门票，不含往返车票）。9月18日10:30到长沙南站，住五一广场附近性价比酒店，9月20日18:30从长沙南站返程。想吃臭豆腐、糖油粑粑和湘菜，去岳麓山、橘子洲、湖南博物院、太平街，喜欢城市漫步和夜景，节奏不要太赶。',
      media: [],
    })
    const plan = generatePlans(understanding.intent)[0]
    const stops = Object.values(plan.days).flat()

    expect(understanding.intent.hotel).toBe('五一广场附近性价比酒店')
    expect(understanding.intent.pace).toBe('relaxed')
    expect(understanding.intent.preferences).toEqual(expect.arrayContaining(['本地美食', '夜景']))
    expect(plan.knowledge.city).toBe('长沙')
    expect(stops.map((stop) => stop.name)).toEqual(expect.arrayContaining(['岳麓山风景名胜区', '橘子洲景区', '湖南博物院', '长沙臭豆腐', '糖油粑粑', '口味虾 / 湘菜晚餐']))
    expect(stops.some((stop) => stop.type === '住宿' && stop.name.includes('五一广场'))).toBe(true)
    expect(plan.budget).toBeLessThanOrEqual(3000)
    expect(plan.validation.passed).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractResearchTerms } from '../scripts/import-travel-research'
import { getLocalGuideContext } from '../src/services/trip/localGuides'
import { guideContextForPrompt, searchTravelGuides } from './travel-guides'
import { cityKnowledge } from '../src/services/trip/cityKnowledge'
import { moreCityKnowledge } from '../src/services/trip/more-city-knowledge'
import { generatePlans, understandTrip } from '../src/services/trip/planner'
import { searchGuideCandidates, type GuideKnowledgeBase } from '../src/services/trip/guides'
import reviewedGuideData from '../data/travel-guides-reviewed-20-cities.json'
import { regionalCommunitySignals } from '../src/services/trip/regional-community-signals'
import { socialResearchGuides } from '../src/services/trip/socialResearch'

const review = JSON.parse(readFileSync(resolve('data/travel-research/2026-09-06-review.json'), 'utf8')) as { cities: Array<{ city: string; stay: string[] }> }
const kb = JSON.parse(readFileSync(resolve('data/travel-guides.json'), 'utf8')) as GuideKnowledgeBase
const batch = kb.guides.filter(guide => guide.research?.batch === '2026-09-06')
const sources = [...reviewedGuideData.guides, ...kb.guides, ...regionalCommunitySignals, ...socialResearchGuides]

describe('September cross-platform travel research integration', () => {
  it('keeps exact source locations and does not manufacture terms from a city label', () => {
    expect(extractResearchTerms(['老友粉', '青秀山'], [{ text: '南宁旅游攻略', field: 'search', locator: 'result:1' }])).toEqual([])
    expect(extractResearchTerms(['老友粉'], [{ text: '来一碗老友粉', field: 'subtitle', locator: '20s-23s' }])).toEqual([{ term: '老友粉', field: 'subtitle', locator: '20s-23s' }])
  })

  it('preserves source coverage without shipping raw bodies or session tokens', () => {
    expect(new Set(batch.map(guide => guide.city)).size).toBe(20)
    expect(new Set(batch.filter(guide => guide.research?.readLevel === 'video-subtitle').map(guide => guide.city)).size).toBe(20)
    // Later research may append records; the original pre-September-6 baseline remains intact.
    expect(kb.guides.filter(guide => guide.research?.batch !== '2026-09-06' && !guide.id.startsWith('experience-2026-09-07-'))).toHaveLength(1004)
    for (const guide of batch) {
      expect(guide.research?.evidence.length).toBeGreaterThan(0)
      expect(guide.claims.every(claim => claim.verified === false)).toBe(true)
      expect(new URL(guide.sourceUrl).search).toBe('')
      expect('content' in guide).toBe(false)
      expect('subtitle' in guide).toBe(false)
    }
  })

  it('uses corrected hotel locations but does not turn an official name into a verified room quote', () => {
    const jinan = cityKnowledge['济南'].hotelOptions.find(hotel => hotel.name === '济南绿发贵和洲际酒店')!
    expect(jinan.source.kind).toBe('official')
    expect(jinan.verified).toBe(false)
    expect(cityKnowledge['福州'].hotelOptions.find(hotel => hotel.name === '福州世茂洲际酒店')?.area).toBe('台江 / 茶亭')
    expect(cityKnowledge['宁波'].hotelOptions.find(hotel => hotel.name === '宁波东钱湖华茂希尔顿酒店')?.area).toContain('东钱湖')
  })

  it('leaves unlocated places and unread current menus unknown', () => {
    expect(Object.values(moreCityKnowledge).flat().every(item => item.coordinates === undefined)).toBe(true)
    const venue = cityKnowledge['南昌'].items.find(item => item.name === '广源隆饼庄')!
    expect(venue.venueName).toBe('广源隆饼庄')
    expect(venue.price.state).toBe('unknown')
    expect(venue.coordinates).toBeUndefined()
    expect(venue.verified).toBe(false)
  })

  for (const { city, stay } of review.cities) {
    it(`${city}: retrieves the added sources locally and on the server and generates three plans`, () => {
      const query = `${city}3天2晚，2人预算6000元，本地美食和城市漫步，住宿在${stay[0]}。`
      const local = getLocalGuideContext(city, query)
      const remote = searchTravelGuides(city, query)
      // guides.ts reserves reviewed records, ranks relevance, deduplicates URLs,
      // then takes eight. The September batch has no reserved top-eight position.
      // Check historical recall independently from the expanded corpus's ranking.
      const historical = searchGuideCandidates({ ...kb, guides: batch }, city, query, 8)
      expect(historical.candidates.length).toBeGreaterThan(0)
      expect(historical.candidates.every(guide => guide.city === city && guide.research?.batch === '2026-09-06')).toBe(true)
      expect(local.candidates).toHaveLength(8)
      expect(remote.candidates).toEqual(local.candidates)
      expect(local.candidates.some(guide => guide.id.startsWith('reviewed20-') && guide.research?.evidence.length)).toBe(true)
      expect(new Set(local.candidates.map(guide=>guide.sourceUrl.split(/[?#]/)[0])).size).toBe(8)
      for (const guide of local.candidates) {
        expect(guide.city).toBe(city)
        expect(sources.find(source=>source.id===guide.id && source.sourceUrl===guide.sourceUrl)).toEqual(guide)
      }
      const prompt = guideContextForPrompt(remote)
      expect(prompt.map(guide => guide.hotelHints)).toEqual(remote.candidates.map(guide => guide.hotelHints ?? []))
      expect(prompt.every(guide => typeof guide.sourceReadLevel === 'string')).toBe(true)
      const { intent } = understandTrip({ text: query, media: [] })
      const plans = generatePlans(intent, local)
      expect(plans).toHaveLength(3)
      expect(plans.every(plan => Object.values(plan.days).flat().length > 0)).toBe(true)
      for (const stop of plans.flatMap(plan => Object.values(plan.days).flat())) {
        if (!stop.verified) expect(stop.longitude).toBeUndefined()
      }
    })
  }
})

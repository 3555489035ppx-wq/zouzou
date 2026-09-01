import { describe, expect, it } from 'vitest'
import { blockedProvider, buildJourneyImageQueries, inspectCandidate, isUserFacingCover, rankJourneyImages, selectJourneyCover, type ImageCandidate, type JourneyImageInput } from './index'

const journey: JourneyImageInput = { id: 'shanghai-date', title: '外滩夜景约会', category: '约会', city: '上海', places: ['外滩'], activities: ['夜景'] }
const candidate = (overrides: Partial<ImageCandidate> = {}): ImageCandidate => ({ id: 'candidate', journeyId: journey.id, source: 'wikimedia', sourceUrl: 'source', originalUrl: 'original', localPath: '/assets/cover.jpg', cachedUrl: '/assets/cover.jpg', width: 1920, height: 1080, aspectRatio: 16 / 9, category: 'date', city: '上海', placeName: '外滩', searchQuery: '上海 外滩 夜景 实拍', hasOverlayText: false, hasWatermark: false, hasQrCode: false, isScreenshot: false, isCollage: false, imageHash: 'a', createdAt: '2026-01-01T00:00:00.000Z', sharpnessScore: 80, textAreaRatio: 0, relevanceHints: ['上海', '外滩', '夜景'], ...overrides })

describe('journey image system', () => {
  it('builds several place-led queries', () => { const queries = buildJourneyImageQueries(journey); expect(queries.length).toBeGreaterThanOrEqual(5); expect(queries.some((query) => query.includes('外滩'))).toBe(true) })
  it('asks for a food-only, person-free image when the route is dining', () => {
    const queries = buildJourneyImageQueries({ id: 'hangzhou-food', title: '杭州西湖醋鱼', category: '聚餐', city: '杭州', places: ['西湖醋鱼'] })
    expect(queries.some((query) => /西湖醋鱼/.test(query) && /菜品|食物/.test(query) && /无人物/.test(query))).toBe(true)
  })
  it('rejects low-resolution, blurry, text, QR, screenshot, collage, black-border, signage and portrait candidates', () => { const result = inspectCandidate(candidate({ width: 800, height: 600, sharpnessScore: 20, hasOverlayText: true, hasQrCode: true, isScreenshot: true, isCollage: true, hasBlackBorder: true, isSignage: true, aspectRatio: .76 }), journey); expect(result.reasons).toEqual(expect.arrayContaining(['too_small', 'blur', 'overlay_text', 'qr_code', 'screenshot', 'collage', 'black_border', 'signage', 'portrait'])) })
  it('rejects person-led and visibly watermarked candidates', () => {
    const result = inspectCandidate(candidate({ hasPeople: true, hasWatermark: true, watermarkScore: .24, textAreaRatio: .12 }), journey)
    expect(result.reasons).toEqual(expect.arrayContaining(['people', 'watermark']))
  })
  it('ranks an exact-place landscape candidate ahead of a generic city image', () => { const exact = candidate({ id: 'exact', imageHash: 'exact', placeName: '外滩', relevanceHints: ['上海', '外滩', '夜景'] }); const generic = candidate({ id: 'generic', imageHash: 'generic', placeName: undefined, relevanceHints: ['上海', '城市风景'], sharpnessScore: 100 }); const ranked = rankJourneyImages(journey, [generic, exact]); expect(ranked.accepted[0].id).toBe('exact'); expect(ranked.accepted[0].relevanceScore).toBeGreaterThanOrEqual(60) })
  it('matches a clean gallery landmark named in the route title', () => {
    const ranked = rankJourneyImages({ id: 'hangzhou-walk', title: '西湖边慢慢走', category: '周末', city: '杭州', places: ['断桥残雪'], tags: ['湖边散步'] }, [candidate({ id: 'west-lake', city: '杭州', placeName: '西湖', relevanceHints: ['杭州', '西湖'], imageHash: 'west-lake' })])
    expect(ranked.accepted[0]?.relevanceScore).toBeGreaterThanOrEqual(60)
  })
  it('rejects duplicate hashes and ranks the clean candidate first', () => { const ranked = rankJourneyImages(journey, [candidate({ id: 'duplicate' }), candidate({ id: 'clean', imageHash: 'b', sharpnessScore: 90 })], new Set(['a'])); expect(ranked.rejected).toHaveLength(1); expect(ranked.accepted[0].id).toBe('clean') })
  it('keeps a manual override untouched', () => { const manual = { ...candidate(), qualityScore: 99, relevanceScore: 99, textScore: 100, sharpnessScore: 80, selected: true }; const selected = selectJourneyCover({ ...journey, manualOverride: manual }, []); expect(selected.image?.manualOverride).toBe(true) })
  it('does not allow a research screenshot to become a user-facing cover', () => {
    const manual = candidate({ cachedUrl: '/assets/journey-images/social-research/bilibili/research.jpg' }) as never
    expect(selectJourneyCover({ ...journey, city: '不存在的城市', places: ['不存在地点'], manualOverride: manual }, []).image).toBeUndefined()
  })
  it('blocks known people-heavy and watermarked static covers', () => {
    expect(isUserFacingCover('/assets/locations/harbin-cover-01.jpg')).toBe(false)
    expect(isUserFacingCover('/assets/locations/yanji-cover-02.jpg')).toBe(false)
    expect(isUserFacingCover('/assets/journey-images/baidu/baidu-f7cef153-2.jpg')).toBe(false)
    expect(isUserFacingCover('/assets/journey-images/baidu/baidu-5742fc94-5.jpg')).toBe(false)
    expect(isUserFacingCover('/assets/locations/harbin-cover-02.jpg')).toBe(true)
  })
  it('reports an unavailable public provider and falls back without blocking a journey', async () => { const provider = await blockedProvider('baidu').search(['上海 外滩 实拍']); expect(provider).toMatchObject({ blocked: true, reason: 'PROVIDER_BLOCKED' }); expect(selectJourneyCover({ ...journey, city: '不存在的城市', places: ['不存在地点'] }, []).status).toBe('fallback') })
})

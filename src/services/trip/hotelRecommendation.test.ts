import { describe, expect, it } from 'vitest'
import { getCityKnowledge } from './cityKnowledge'
import {
  extractHotelExperienceHints,
  extractHotelNames,
  getHotelRecommendations,
} from './hotelRecommendation'
import { understandTrip } from './planner'
import type { GuideContext } from './guides'

describe('hotel recommendations', () => {
  it('extracts named hotels without turning generic hotel phrases into candidates', () => {
    expect(extractHotelNames('杭州开元名都大酒店住宿体验不错，离西湖方便。', '杭州')).toEqual(['开元名都大酒店'])
    expect(extractHotelNames('杭州酒店攻略：住哪里更方便？', '杭州')).toEqual([])
    expect(extractHotelExperienceHints('地铁方便，周边吃饭方便，记得避坑。')).toEqual(expect.arrayContaining(['交通方便', '周边吃饭方便', '避坑提醒']))
  })

  it('puts community hotel names and experience labels into ranked candidates', () => {
    const understanding = understandTrip({
      text: '2026年9月18日到9月20日去杭州，3天2晚，2个人，预算3000元，住西湖附近。',
      media: [],
    })
    const guideContext: GuideContext = {
      city: '杭州',
      candidates: [{
        id: 'guide-hangzhou-hotel-1',
        city: '杭州',
        platform: 'bilibili',
        sourceUrl: 'https://www.bilibili.com/video/BV1hotel',
        title: '杭州西湖住宿怎么选',
        author: '测试作者',
        publishedAt: null,
        fetchedAt: '2026-08-30T00:00:00.000Z',
        likes: 800,
        summary: '开元名都大酒店，地铁方便，周边吃饭方便，适合预算有限的旅行。',
        tags: ['酒店体验'],
        placeHints: ['西湖'],
        hotelHints: ['交通方便', '周边吃饭方便'],
        hotelNames: ['开元名都大酒店'],
        claims: [],
        permission: 'unknown',
      }],
      matchedTerms: ['酒店', '西湖'],
      generatedAt: '2026-08-30T00:00:00.000Z',
      disclaimer: '仅作社区体验参考。',
    }

    const recommendations = getHotelRecommendations(getCityKnowledge('杭州'), understanding.intent, guideContext)
    const named = recommendations.find((option) => option.name === '开元名都大酒店')

    expect(named).toBeDefined()
    expect(named?.communityTags).toEqual(expect.arrayContaining(['交通方便', '周边吃饭方便']))
    expect(named?.communityEvidence).toBe(1)
    expect(named?.communitySources?.[0].url).toBe('https://www.bilibili.com/video/BV1hotel')
    expect(named?.mapUrl).toContain(encodeURIComponent('杭州 开元名都大酒店'))
    expect(named?.bookingUrl).toContain(encodeURIComponent('杭州 开元名都大酒店'))
    expect(recommendations).toHaveLength(3)
    expect(recommendations.map((option) => option.tier)).toEqual(['budget', 'comfort', 'premium'])
  })
})

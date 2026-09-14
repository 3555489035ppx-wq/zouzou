import { describe, expect, it } from 'vitest'
import { experienceConsensus, experienceCoreLimit, experienceAdvice, extractExperiencePreferences, experienceStartTime, reviewedExperienceAdvice, type ExperienceSource } from './experiencePolicy'
import { completePlanOptions, generatePlans, understandTrip } from './planner'
import { experienceRouteStart } from './experiencePolicy'

const source = (platform: ExperienceSource['platform'], author: string, extra: Partial<ExperienceSource> = {}): ExperienceSource =>
  ({platform,author,url:`https://example.com/${author}`,readLevel:'note-text',supports:true,...extra})

describe('experience rules used for itinerary planning', () => {
  it('preserves editorial periods when displaying and copying discovery routes', () => {
    expect(experienceRouteStart({timePeriod:['下午','晚上']})).toBe('15:30')
    expect(experienceRouteStart({timePeriod:['上午'],category:'聚餐'})).toBe('09:30')
    expect(experienceRouteStart({timePeriod:['晚上']})).toBe('18:00')
  })
  it('adds dinner after an afternoon park visit instead of shifting it to night', () => {
    const intent=understandTrip({text:'成都3天2晚，情侣，第一次去，不想特别累，喜欢吃，想拍照，不吃辣，不吃海鲜，预算5000',media:[]}).intent
    const plan=generatePlans(intent)[0]
    const park=plan.days['Day 1'].find(stop=>stop.name==='人民公园')
    expect(park).toBeDefined()
    expect(park!.time<'18:00').toBe(true)
    const dinner=plan.days['Day 1'].find(stop=>stop.type==='晚餐')
    expect(dinner!.time>park!.time).toBe(true)
  })
  it('makes the user example genuinely different and keeps unrequested suburbs out of a short first visit', () => {
    const intent=understandTrip({text:'成都3天2晚，情侣，第一次去，不想特别累，喜欢吃，想拍照，预算5000',media:[]}).intent
    const plans=generatePlans(intent)
    expect(completePlanOptions(plans)).toHaveLength(3)
    const signatures=plans.map(p=>JSON.stringify(Object.values(p.days).map(day=>day.filter(s=>!s.fixed).map(s=>s.name))))
    expect(new Set(signatures).size).toBe(3)
    for(const plan of plans) expect(Object.values(plan.days).flat().some(s=>s.name==='麓湖水城景区')).toBe(false)
    for(const plan of plans) expect(plan.days['Day 3'].filter(s=>!s.fixed && !/餐|小吃|休息/.test(s.type) && s.durationMinutes>=60).length).toBeLessThanOrEqual(2)
  })
  it('uses only reviewed cross-platform advice for places actually in the same day', () => {
    expect(reviewedExperienceAdvice('南京',['中山陵','中山陵音乐台'])).toHaveLength(1)
    expect(reviewedExperienceAdvice('南京',['中山陵'])).toHaveLength(0)
    expect(reviewedExperienceAdvice('南京',['中山陵','音乐台'],['音乐台'])).toHaveLength(0)
    expect(reviewedExperienceAdvice('杭州',['西湖','曲院风荷','白堤'])).toHaveLength(0)
  })
  it('retains scenario and late-start requests without reversing explicit dislikes', () => {
    const intent=understandTrip({text:'成都3天2晚，情侣，睡到自然醒，预算5000',media:[]}).intent
    expect(intent.preferences).toContain('情侣')
    expect(intent.preferences).toContain('晚起')
    expect(experienceStartTime(intent)).toBe('10:30')
    expect(extractExperiencePreferences('不喜欢拍照，不早起')).not.toContain('拍照')
    expect(extractExperiencePreferences('不早起')).toContain('晚起')
  })
  it('does not promote titles, crossposts or conflicts to consensus', () => {
    expect(experienceConsensus([source('bilibili','a',{readLevel:'search-metadata'}),source('xiaohongshu','b',{readLevel:'search-metadata'})]).level).toBe('candidate')
    expect(experienceConsensus([source('bilibili','same'),source('xiaohongshu','same')]).level).toBe('candidate')
    expect(experienceConsensus([source('bilibili','a'),source('xiaohongshu','b')]).level).toBe('supported_pattern')
    expect(experienceConsensus([source('bilibili','a'),source('xiaohongshu','b',{conflicts:true})]).level).toBe('candidate')
  })
  it('requires multiple independent authors on every platform for high confidence', () => {
    const evidence = (['bilibili','xiaohongshu','douyin'] as const).flatMap(p=>[source(p,`${p}-a`),source(p,`${p}-b`)])
    expect(experienceConsensus(evidence).level).toBe('high_confidence_experience_pattern')
    expect(experienceConsensus(evidence.slice(0,-1)).level).toBe('supported_pattern')
  })
  it('reduces late arrival and early departure while honoring relaxed pace', () => {
    const intent = understandTrip({text:'成都3天2晚，情侣，不想太累，不吃辣，预算5000',media:[]}).intent
    expect(intent.pace).toBe('relaxed')
    intent.arrivalTime='16:00'; intent.departureTime='12:00'; intent.pace='relaxed'
    expect(experienceCoreLimit(intent,'rich',0)).toBe(1)
    expect(experienceCoreLimit(intent,'rich',1)).toBe(2)
    expect(experienceCoreLimit(intent,'rich',2)).toBe(1)
    expect(experienceAdvice(intent).meal).toContain('辣油')
  })
  it('keeps an evening departure day to at most two optional core visits', () => {
    const intent = understandTrip({text:'成都3天2晚，预算5000，20:00返程。',media:[]}).intent
    for (const variant of ['match','easy','rich'] as const) {
      expect(experienceCoreLimit(intent,variant,2)).toBeLessThanOrEqual(2)
    }
    for (const plan of generatePlans(intent)) {
      const visits = plan.days['Day 3'].filter(stop=>!stop.fixed&&!/餐|小吃|休息/.test(stop.type)&&stop.durationMinutes>=60)
      expect(visits.length).toBeLessThanOrEqual(2)
    }
  })
  it('actually limits optional core visits on generated late arrival days', () => {
    const intent = understandTrip({text:'成都3天2晚，轻松旅行，预算5000',media:[]}).intent
    intent.arrivalTime='16:00'; intent.departureTime='12:00'; intent.pace='relaxed'
    for(const plan of generatePlans(intent)) {
      const cores=plan.days['Day 1'].filter(s=>!s.fixed && !/餐|小吃|休息/.test(s.type) && s.durationMinutes>=60)
      expect(cores.length).toBeLessThanOrEqual(1)
    }
  })
})

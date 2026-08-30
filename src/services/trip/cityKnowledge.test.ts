import { describe, expect, it } from 'vitest'
import { cityKnowledge } from './cityKnowledge'

describe('city knowledge coverage', () => {
  it('covers every supported city with named attractions, food and local-life entries', () => {
    expect(Object.keys(cityKnowledge)).toHaveLength(20)
    Object.values(cityKnowledge).forEach((knowledge) => {
      expect(knowledge.items.length).toBeGreaterThanOrEqual(6)
      expect(knowledge.items.some((item) => item.category === 'food' || item.category === 'restaurant')).toBe(true)
      expect(knowledge.items.some((item) => item.tags.includes('本地人项目') || item.tags.includes('本地生活'))).toBe(true)
    })
  })

  it('keeps the requested Nanjing and Wuhan landmarks searchable', () => {
    const nanjing = cityKnowledge['南京'].items.map((item) => item.name)
    const wuhan = cityKnowledge['武汉'].items.map((item) => item.name)

    expect(nanjing).toEqual(expect.arrayContaining(['中山陵音乐台', '南京欢乐谷']))
    expect(wuhan).toEqual(expect.arrayContaining(['黄鹤楼', '东湖风景区—东湖绿道', '湖北省博物馆', '武汉欢乐谷', '粮道街过早—大成路早市']))
  })
})

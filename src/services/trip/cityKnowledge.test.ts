import { describe, expect, it } from 'vitest'
import { cityKnowledge } from './cityKnowledge'

describe('city knowledge coverage', () => {
  it('covers every supported city with named attractions, food and local-life entries', () => {
    expect(Object.keys(cityKnowledge)).toHaveLength(40)
    Object.values(cityKnowledge).forEach((knowledge) => {
      expect(knowledge.items.length).toBeGreaterThanOrEqual(30)
      expect(knowledge.items.filter((item) => item.category === 'attraction' || item.category === 'activity').length).toBeGreaterThanOrEqual(20)
      expect(knowledge.items.some((item) => item.category === 'food' || item.category === 'restaurant')).toBe(true)
      expect(knowledge.items.some((item) => item.tags.includes('本地人项目') || item.tags.includes('本地生活'))).toBe(true)
      expect(knowledge.hotelOptions).toHaveLength(3)
      expect(knowledge.hotelOptions.map((hotel) => hotel.tier)).toEqual(['budget', 'comfort', 'premium'])
      expect(knowledge.hotelOptions.every((hotel) => !/待选|核心区酒店|市中心酒店/.test(hotel.name))).toBe(true)
    })
  })

  it('keeps the requested Nanjing and Wuhan landmarks searchable', () => {
    const nanjing = cityKnowledge['南京'].items.map((item) => item.name)
    const wuhan = cityKnowledge['武汉'].items.map((item) => item.name)

    expect(nanjing).toEqual(expect.arrayContaining(['中山陵音乐台', '南京欢乐谷', '明孝陵', '总统府', '侵华日军南京大屠杀遇难同胞纪念馆']))
    expect(wuhan).toEqual(expect.arrayContaining(['黄鹤楼', '东湖风景区—东湖绿道', '湖北省博物馆', '武汉欢乐谷', '粮道街过早—大成路早市']))
    expect(wuhan).toEqual(expect.arrayContaining(['武汉大学', '古德寺', '武汉过早路线：粮道街—大成路']))
    expect(cityKnowledge['杭州'].items.some((item) => item.name.includes('西湖醋鱼'))).toBe(true)
    expect(cityKnowledge['上海'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['上海迪士尼度假区', '上海天文馆', '朱家角古镇']))
    expect(cityKnowledge['北京'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['八达岭长城', '恭王府', '国家自然博物馆']))
    expect(cityKnowledge['南京'].sources.some((source) => source.kind === 'official')).toBe(true)
    expect(cityKnowledge['武汉'].sources.some((source) => source.label.includes('百度百科'))).toBe(true)
  })

  it('keeps the regional expansion searchable with named places and foods', () => {
    expect(Object.keys(cityKnowledge)).toEqual(expect.arrayContaining(['康定', '大理', '沈阳', '温州', '乌鲁木齐', '拉萨', '林芝']))
    expect(cityKnowledge['康定'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['溜溜城', '康定情歌木格措风景区']))
    expect(cityKnowledge['康定'].items.some((item) => item.name.includes('牦牛肉鲜菌汤锅') && item.venueName)).toBe(true)
    expect(cityKnowledge['大理'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['大理古城', '龙龛码头看日出']))
    expect(cityKnowledge['大理'].items.some((item) => item.name.includes('喜洲粑粑') && item.venueName)).toBe(true)
    expect(cityKnowledge['拉萨'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['布达拉宫', '大昭寺']))
    expect(cityKnowledge['拉萨'].items.some((item) => item.name.includes('甜茶') && item.venueName)).toBe(true)
  })

  it('adds concrete local venues and projects without bypassing food filters', () => {
    const hangzhouVenue = cityKnowledge['杭州'].items.find((item) => item.name === '芳明小吃')
    const nanjingVenue = cityKnowledge['南京'].items.find((item) => item.name === '江南春面馆')
    const lishuiVenue = cityKnowledge['丽水'].items.find((item) => item.name === '老陶大馄饨')

    expect(hangzhouVenue?.category).toBe('restaurant')
    expect(hangzhouVenue?.source.kind).toBe('community')
    expect(nanjingVenue?.category).toBe('restaurant')
    expect(lishuiVenue?.summary).toContain('馄饨')
    expect(cityKnowledge['武汉'].items.map((item) => item.name)).toEqual(expect.arrayContaining(['蔡林记热干面', '宝善堂菜市场逛吃']))
    expect(Object.values(cityKnowledge).every((knowledge) => knowledge.items.some((item) => item.category === 'restaurant' && item.tags.includes('本地餐馆')))).toBe(true)
  })

  it('adds a core-look summary to every city knowledge pack', () => {
    Object.values(cityKnowledge).forEach((knowledge) => {
      expect(knowledge.items.some((item) => item.summary.includes('核心看点：'))).toBe(true)
    })

    const nanjingMuseum = cityKnowledge['南京'].items.find((item) => item.name === '南京博物院')
    expect(nanjingMuseum?.summary).toContain('历史馆')
    expect(nanjingMuseum?.summary).toContain('建议逛法：')
  })
})

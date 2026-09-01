import { describe, expect, it } from 'vitest'
import { dedupeKnowledgePlaces, getPlaceKnowledge, journeyKnowledge, placeKnowledge, type PlaceKnowledge } from './goohKnowledge'

describe('normalized travel knowledge', () => {
  it('keeps the representative journey set structured', () => {
    expect(journeyKnowledge.length).toBeGreaterThanOrEqual(10)
    expect(new Set(journeyKnowledge.map((item) => item.city)).size).toBeGreaterThanOrEqual(8)
    expect(journeyKnowledge.every((item) => item.days.length > 0 && item.places.length > 0)).toBe(true)
  })

  it('deduplicates a place by city and canonical name while merging facts', () => {
    const base = placeKnowledge.find((item) => item.name === '外滩')
    if (!base) throw new Error('Expected the normalized Shanghai place')
    const duplicate: PlaceKnowledge = { ...base, id: 'duplicate', highlights: ['重复来源的新亮点'], tips: ['重复来源的新提示'] }
    const result = dedupeKnowledgePlaces([base, duplicate])
    expect(result).toHaveLength(1)
    expect(result[0].highlights).toEqual(expect.arrayContaining(['城市夜景', '重复来源的新亮点']))
    expect(result[0].tips).toEqual(expect.arrayContaining(['重复来源的新提示']))
  })

  it('marks changing ticket and opening facts as time-sensitive', () => {
    const place = getPlaceKnowledge('故宫', '北京')
    expect(place?.timeSensitive).toBe(true)
    expect(place?.source.type).toBe('competitor-research')
  })
})

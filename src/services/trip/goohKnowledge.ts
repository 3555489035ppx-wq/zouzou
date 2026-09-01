import rawKnowledge from '../../../data/gooh-knowledge.json'

export type KnowledgeResearchSource = {
  type: 'competitor-research'
  app: 'Gooh'
  journey: string
  capturedAt: string
  evidenceStatus: 'partial' | 'context-only'
  note?: string
}

export type JourneyKnowledge = {
  id: string
  city: string
  title: string
  theme: string
  duration: number
  days: Array<{ day: number; places: string[] }>
  places: string[]
  food: string[]
  transport: string[]
  activities: string[]
  tips: string[]
  source: KnowledgeResearchSource
}

export type PlaceKnowledge = {
  id: string
  name: string
  city: string
  district?: string
  category: string
  summary: string
  highlights: string[]
  recommendedActivities: string[]
  openingHours?: string
  ticket?: string
  recommendedDuration?: string
  bestTime?: string
  tips: string[]
  nearbyPlaces?: string[]
  coordinates?: [number, number]
  timeSensitive: boolean
  source: KnowledgeResearchSource
}

type KnowledgePayload = { journeys: JourneyKnowledge[]; places: PlaceKnowledge[] }

const knowledgePayload = rawKnowledge as unknown as KnowledgePayload

export const journeyKnowledge = knowledgePayload.journeys

const knowledgeKey = (item: Pick<PlaceKnowledge, 'city' | 'name'>) => `${item.city.trim().toLocaleLowerCase()}::${item.name.trim().toLocaleLowerCase()}`

export function dedupeKnowledgePlaces(items: PlaceKnowledge[]) {
  const byKey = new Map<string, PlaceKnowledge>()
  for (const item of items) {
    const key = knowledgeKey(item)
    const previous = byKey.get(key)
    if (!previous) {
      byKey.set(key, item)
      continue
    }
    byKey.set(key, {
      ...previous,
      highlights: [...new Set([...previous.highlights, ...item.highlights])],
      recommendedActivities: [...new Set([...previous.recommendedActivities, ...item.recommendedActivities])],
      tips: [...new Set([...previous.tips, ...item.tips])],
      nearbyPlaces: [...new Set([...(previous.nearbyPlaces ?? []), ...(item.nearbyPlaces ?? [])])],
      coordinates: previous.coordinates ?? item.coordinates,
    })
  }
  return [...byKey.values()]
}

export const placeKnowledge = dedupeKnowledgePlaces(knowledgePayload.places)

export function getPlaceKnowledge(name: string, city: string) {
  const normalizedName = name.trim().toLocaleLowerCase()
  const normalizedCity = city.trim().toLocaleLowerCase()
  return placeKnowledge.find((item) => item.city.toLocaleLowerCase() === normalizedCity && item.name.toLocaleLowerCase() === normalizedName)
}

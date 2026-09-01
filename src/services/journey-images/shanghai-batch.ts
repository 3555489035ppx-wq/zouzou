import { cityKnowledge } from '../trip/cityKnowledge'
import type { JourneyImageCategory, JourneyImageInput } from './index'

export type ShanghaiJourneyImageBatch = JourneyImageInput & {
  batchCategory: JourneyImageCategory
  knowledgeNames: string[]
}

type KnowledgeItem = (typeof cityKnowledge['上海']['items'])[number]

const items = cityKnowledge['上海'].items

const findItems = (predicate: (item: KnowledgeItem) => boolean, fallback: (item: KnowledgeItem) => boolean) => {
  const selected = items.filter(predicate)
  return [...selected, ...items.filter(fallback)].filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index).slice(0, 5)
}

const makeEntry = (category: JourneyImageCategory, item: KnowledgeItem, index: number, related: KnowledgeItem[]): ShanghaiJourneyImageBatch => {
  const titleSuffix = category === 'travel' ? '城市探索' : category === 'weekend' ? '周末慢走' : category === 'date' ? '约会实拍' : '逛吃实拍'
  // Only pair a cover query with a nearby knowledge item. A cross-district
  // companion makes both the route title and the downloaded image ambiguous.
  const extra = related.find((candidate) => candidate.name !== item.name && candidate.area === item.area)
  return {
    id: `shanghai-image-batch-${category}-${index + 1}`,
    title: `${item.name} · ${titleSuffix}`,
    category,
    batchCategory: category,
    city: '上海',
    district: item.area,
    places: [item.name, extra?.name].filter((value): value is string => Boolean(value)),
    activities: item.tags,
    timePeriods: item.tags.filter((tag) => /上午|下午|夜|周末|早餐|午餐|晚餐|一日|半日/.test(tag)),
    tags: [...item.tags, category],
    knowledgeNames: [item.name, extra?.name].filter((value): value is string => Boolean(value)),
  }
}

/**
 * The first acquisition batch is derived from the real Shanghai knowledge-base
 * entries, rather than a hand-written list of image keywords. Some entries can
 * intentionally appear in more than one use-case (for example 外滩 is both a
 * travel landmark and a date setting), while every title and place remains tied
 * to a knowledge item.
 */
export function buildShanghaiImageBatch(): ShanghaiJourneyImageBatch[] {
  const groups: Array<[JourneyImageCategory, KnowledgeItem[]]> = [
    ['travel', findItems((item) => item.category === 'attraction' && /城市|经典|观景|园林|滨江/.test(item.tags.join(' ')), (item) => item.category === 'attraction')],
    ['weekend', findItems((item) => /城市漫步|街区|公园|展览|小店/.test(item.tags.join(' ')), (item) => item.category === 'attraction' || item.category === 'activity')],
    ['date', findItems((item) => /夜景|滨江|咖啡|逛店|夜逛/.test(item.tags.join(' ')), (item) => item.category === 'attraction' || item.category === 'activity')],
    ['dining', findItems((item) => item.category === 'food' || item.category === 'restaurant' || /逛吃|夜市/.test(item.tags.join(' ')), (item) => item.category === 'food' || item.category === 'restaurant' || item.category === 'activity')],
  ]
  return groups.flatMap(([category, selected]) => selected.map((item, index) => makeEntry(category, item, index, selected)))
}

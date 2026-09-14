import type { DiscoverItem, Route } from '../../demo-data/discover'

const tagNames: Record<string, string> = {
  Citywalk: 'City Walk', CityWalk: 'City Walk', '城市漫步': 'City Walk',
  '慢慢走': '松弛', '经典地标': '经典', '夜景路线': '夜游', '夜景': '夜游', '夜逛': '夜游',
  '本地美食': '美食', '逛吃': '美食', '边走边吃': '美食', '本地餐馆': '美食', '聚餐': '美食',
}
const genericTags = new Set(['城市精选', '旅行', '知识库候选', '本地人项目'])

/** Only normalize existing labels; morning itineraries must not inherit old night tags. */
export function experienceTags(item: Pick<DiscoverItem, 'tags' | 'category' | 'title'>, route?: Pick<Route, 'timePeriod'>) {
  const morning = /早餐|早走|晨间|晨游/.test(item.title) || route?.timePeriod?.some(time => /早餐|早晨|清晨/.test(time))
  const labels = [...new Set([...item.tags, item.category].map(tag => tagNames[tag] ?? tag))]
    .filter(tag => !genericTags.has(tag) && !(morning && tag === '夜游'))
  const priority = (tag: string) => ['早餐', '美食'].includes(tag) ? 0 : ['约会', '周末'].includes(tag) ? 2 : 1
  return labels.sort((a, b) => priority(a) - priority(b))
}

export const discoveryScenes = ['City Walk', '松弛', '美食', '早餐', '夜游', '经典', '人文', '园林', '亲子', '拍照', '周末', '约会']

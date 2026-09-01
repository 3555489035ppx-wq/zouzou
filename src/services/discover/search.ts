import type { DiscoverItem, Route } from '../../demo-data/discover'

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s，。！？、/|·—\-_:：；]+/g, '')

const searchableText = (item: DiscoverItem, route?: Route) => normalize([
  item.cityId,
  item.title,
  item.subtitle,
  item.category,
  ...item.tags,
  ...(route?.pois.map((poi) => `${poi.name}${poi.address}${poi.category}`) ?? []),
].join(' '))

/**
 * Search stays at the Discover data boundary so the page only renders results.
 * Chinese queries work as a direct substring match; spaced queries match every
 * token, which keeps inputs such as “三亚 慢慢走” useful on small screens.
 */
export const searchDiscoverItems = (
  items: DiscoverItem[],
  query: string,
  getRoute: (routeId: string) => Route | undefined,
) => {
  const trimmed = query.trim()
  if (!trimmed) return items
  const normalizedQuery = normalize(trimmed)
  const tokens = trimmed.split(/[\s，。！？、/|·—\-_:：；]+/).map(normalize).filter(Boolean)
  return items
    .map((item, index) => {
      const route = getRoute(item.routeId)
      const text = searchableText(item, route)
      const title = normalize(item.title)
      const score = (title === normalizedQuery ? 100 : title.includes(normalizedQuery) ? 70 : 0)
        + (tokens.every((token) => text.includes(token)) ? 35 : 0)
        + (text.includes(normalizedQuery) ? 20 : 0)
      return { item, score, index }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}

import { getCityImage } from './city-images'
import { cityProfiles, getCityProfile } from './cities'

export type ContentSource = 'official' | 'knowledge' | 'user'
export type ContentStatus = 'draft' | 'published' | 'hidden'

export type Poi = { id: string; name: string; cityId: string; latitude: number; longitude: number; address: string; category: string; image: string; mapProviderId?: string; coordinateSource?: string; stay: string; transportation: string; introduction: string }
export type Route = { id: string; cityId: string; title: string; summary: string; category: string; tags: string[]; peopleType: string[]; weatherType: string[]; timePeriod: string[]; duration: string; budgetMin: number; budgetMax: number; pois: Poi[]; tips: string[]; recommendedReason: string }
export type DiscoverItem = { id: string; contentSource: ContentSource; authorId?: string; authorName?: string; cityId: string; title: string; subtitle: string; cover: string; category: string; tags: string[]; routeId: string; duration: string; budget: string; poiCount: number; likeCount: number; saveCount: number; useCount: number; publishedAt: string; status: ContentStatus; sourceName?: string; sourceUrl?: string; qualityScore: number; editorScore: number; freshnessScore: number; routeCompletenessScore: number }
export type FeedConfig = { sourceWeights: Record<ContentSource, number>; pageSize: number }

export const discoverFeedConfig: FeedConfig = { sourceWeights: { official: 70, knowledge: 20, user: 10 }, pageSize: 12 }
const cityCoordinates: Record<string, [number, number]> = { 上海: [121.44, 31.21], 杭州: [120.16, 30.25], 北京: [116.40, 39.91], 成都: [104.07, 30.67], 广州: [113.27, 23.13], 深圳: [114.06, 22.54] }
const verifiedRouteCoordinates: Record<string, [number, number][]> = {
  上海: [[121.4396546, 31.2100122], [121.4337292, 31.2062561], [121.4344178, 31.2083571], [121.442273, 31.2166493], [121.4395171, 31.2181135]],
  杭州: [[120.147367, 30.261531], [120.1411727, 30.2597097], [120.1286767, 30.2521659], [120.1181796, 30.2408569], [120.0938589, 30.268683]],
  北京: [[116.3903973, 39.9244589], [116.4063623, 39.9469886], [116.4110049, 39.9455793], [116.4103651, 39.9434824], [116.4904841, 39.9828103]],
  成都: [[104.0548208, 30.6597189], [104.0479169, 30.6677721], [104.0516411, 30.6706369], [104.0863304, 30.6423694], [104.0833515, 30.6441978]],
  广州: [[113.2372814, 23.1097053], [113.2457376, 23.1099977], [113.2422591, 23.1186235], [113.2329007, 23.1175027], [113.2309924, 23.1188908]],
  深圳: [[113.9194304, 22.5403527], [113.9876427, 22.5434178], [113.9879978, 22.5244887], [113.9383043, 22.5148809], [113.9088351, 22.4880191]],
}
const routeSeeds = [
  ['上海','武康路慢慢走','从图书馆到梧桐深处，留一整个下午给散步。','约会',['上海图书馆','武康大楼','Ferguson Lane','安福路','乌鲁木齐中路']],
  ['杭州','西湖边慢慢走','沿湖散步、看展和傍晚的湖风。','周末',['断桥残雪','北山街','曲院风荷','茅家埠','天目里']],
  ['北京','胡同与展览的一天','不赶景点，把午后留给一场展览。','Citywalk',['景山公园','五道营胡同','雍和宫','国子监','798艺术区']],
  ['成都','人民公园喝茶','从一杯盖碗茶走到安顺廊桥的夜色。','周末',['人民公园','宽窄巷子','奎星楼街','九眼桥','安顺廊桥']],
  ['广州','沙面到永庆坊','边走边吃，顺着老城区慢慢逛。','聚餐',['沙面岛','粤海关博物馆','上下九','永庆坊','恩宁路']],
  ['深圳','南头到深圳湾','城中村、海边和日落都放进同一天。','周末',['南头古城','华侨城创意园','深圳湾公园','人才公园','海上世界']],
] as const

const seededRoutes: Route[] = routeSeeds.map(([city, title, summary, category, names], routeIndex) => {
  const [longitude, latitude] = cityCoordinates[city]
  const coordinates = verifiedRouteCoordinates[city]
  const image = getCityImage(city).src
  return { id: `route-${routeIndex + 1}`, cityId: city, title, summary, category, tags: [category, '慢慢走'], peopleType: category === '约会' ? ['情侣', '朋友'] : ['朋友', '独自'], weatherType: ['晴天', '阴天'], timePeriod: ['下午', '周末'], duration: routeIndex === 0 ? '4.5h' : '4h', budgetMin: 120, budgetMax: 220, pois: names.map((name, index) => { const [poiLongitude, poiLatitude] = coordinates?.[index] ?? [longitude + index * .003, latitude + index * .003]; return { id: `poi-${routeIndex + 1}-${index + 1}`, name, cityId: city, latitude: poiLatitude, longitude: poiLongitude, address: `${city}${name}`, category: index === 2 ? '咖啡 / 休息' : '地点', image, mapProviderId: undefined, coordinateSource: coordinates ? 'OpenStreetMap Nominatim · 2026-08-30' : undefined, stay: index === 2 ? '50min' : '35min', transportation: index ? '步行路线待服务核验' : '从这里开始', introduction: `在${name}停留一会，按自己的节奏感受${city}。` } }), tips: ['出发前核对营业时间与预约要求。', '热门时段建议预留等候时间。'], recommendedReason: coordinates ? '地点顺序使用已核验坐标，步行几何由路线服务返回。' : '地点顺序待核验，路线服务返回前不宣称可直接执行。' }
})

const fallbackRoutes: Route[] = Object.keys(cityProfiles).filter((city) => !routeSeeds.some(([seedCity]) => seedCity === city)).map((city, index) => {
  const profile = getCityProfile(city)
  const [longitude, latitude] = profile.mapCenter
  const names = profile.demoLabels.slice(0, 5)
  const image = getCityImage(city).src
  return {
    id: `route-city-${index + 1}`,
    cityId: city,
    title: `${city}慢慢走`,
    summary: `从${names[0]}走到${names.at(-1)}，把当地风景、休息和一顿好饭放进同一天。`,
    category: '周末',
    tags: ['周末', '慢慢走'],
    peopleType: ['朋友', '独自'],
    weatherType: ['晴天', '阴天'],
    timePeriod: ['上午', '下午', '周末'],
    duration: '4h',
    budgetMin: 100,
    budgetMax: 220,
    pois: names.map((name, poiIndex) => ({
      id: `poi-city-${index + 1}-${poiIndex + 1}`,
      name,
      cityId: city,
      latitude: latitude + poiIndex * .003,
      longitude: longitude + poiIndex * .003,
      address: `${city}${name}`,
      category: poiIndex === 2 ? '咖啡 / 休息' : '地点',
      image,
      stay: poiIndex === 2 ? '50min' : '35min',
      transportation: poiIndex ? '步行约 12 分钟' : '从这里开始',
      introduction: `在${name}停留一会，按自己的节奏感受${city}。`,
    })),
    tips: ['出发前核对营业时间与预约要求。', '热门时段建议预留等候时间。'],
    recommendedReason: '地点顺序按相邻区域组织，走起来不需要折返。',
  }
})

export const routes: Route[] = [...seededRoutes, ...fallbackRoutes]

const item = (route: Route, contentSource: ContentSource, suffix: string, score: number): DiscoverItem => ({ id: `post-${route.id}-${suffix}`, contentSource, authorId: contentSource === 'user' ? 'user-xiaopeng' : undefined, authorName: contentSource === 'user' ? '小鹏' : undefined, cityId: route.cityId, title: contentSource === 'knowledge' ? `从${route.pois[0].name}走到${route.pois.at(-1)?.name}` : route.title, subtitle: route.summary, cover: route.pois[0].image, category: route.category, tags: route.tags, routeId: route.id, duration: route.duration, budget: `¥${route.budgetMin}-${route.budgetMax}/人`, poiCount: route.pois.length, likeCount: 96 + score, saveCount: 38 + score, useCount: 12 + score, publishedAt: '2026-08-28', status: 'published', sourceName: contentSource === 'knowledge' ? `${route.cityId}城市攻略知识库` : undefined, sourceUrl: contentSource === 'knowledge' ? 'https://www.mfw.com/' : undefined, qualityScore: score, editorScore: score + 2, freshnessScore: 82, routeCompletenessScore: 94 })

export const discoverItems: DiscoverItem[] = routes.flatMap((route, index) => {
  const primary = item(route, 'official', 'official', 90 - index)
  const knowledge = item(route, 'knowledge', 'knowledge', 84 - index)
  return index === 0 ? [primary, knowledge, item(route, 'user', 'user', 72)] : [primary, knowledge]
})

export const getRoute = (id: string) => routes.find((route) => route.id === id)
export const createUserDiscoverItem = (route: Route): DiscoverItem => item(route, 'user', `shared-${route.id}`, 76)
export const getDiscoverItem = (id: string) => discoverItems.find((entry) => entry.id === id) ?? (id.includes('-shared-route-') ? (() => { const route = getRoute(`route-${id.split('-shared-route-')[1]}`); return route ? createUserDiscoverItem(route) : undefined })() : undefined)
export const rankScore = (entry: DiscoverItem) => entry.qualityScore * .3 + entry.editorScore * .3 + entry.routeCompletenessScore * .25 + entry.freshnessScore * .15
const overlaps = (a: Route, b: Route) => a.pois.filter((poi) => b.pois.some((other) => other.name === poi.name)).length / Math.max(a.pois.length, b.pois.length)
export const getCityTopGuides = (cityId: string, limit = 10) => {
  const sorted = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'knowledge' && entry.status === 'published').sort((a, b) => rankScore(b) - rankScore(a))
  return sorted.reduce<DiscoverItem[]>((kept, candidate) => {
    const route = getRoute(candidate.routeId)
    if (!route || kept.some((entry) => { const keptRoute = getRoute(entry.routeId); return keptRoute && overlaps(route, keptRoute) > .7 })) return kept
    return kept.length < limit ? [...kept, candidate] : kept
  }, [])
}

export const getDiscoverFeed = (cityId: string, config = discoverFeedConfig) => {
  const official = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'official')
  const knowledge = getCityTopGuides(cityId)
  const user = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'user')
  const sources = [official, knowledge, user]
  const result: DiscoverItem[] = []
  for (let index = 0; result.length < config.pageSize && result.length < discoverItems.length; index += 1) {
    const source = sources[index % sources.length]
    const candidate = source[Math.floor(index / sources.length)]
    if (candidate && !result.some((entry) => entry.id === candidate.id)) result.push(candidate)
    if (index > config.pageSize * sources.length) break
  }
  return result
}

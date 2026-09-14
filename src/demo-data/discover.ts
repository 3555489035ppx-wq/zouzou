import { buildMultiDayRoutes } from './discover-multiday'
import { reviewedPhotoForPlace, authorizedSocialPhotos } from './authorized-social-photos'
import { getCityImageGallery } from './city-images'
import { cityNames, cityProfiles, getCityProfile } from './cities'
import { cityKnowledge, isConcreteKnowledgeItem, type CityKnowledgeItem } from '../services/trip/cityKnowledge'
import { coverVisualIdentity, isUserFacingCover, normalizePlaceName, placesMatch } from '../services/journey-images/presentation'
import type { CoverStatus, JourneyImage } from '../services/journey-images'
import { discoverCoverIndex } from './discover-cover-index'
import { getPlaceCoordinates } from '../services/places'
import { isRuntimeCityAllowed } from '../services/trip/runtimeKnowledgePolicy'
import { breakfastRouteEdits } from './discover-breakfast-routes'
import { destinationExpansion } from '../services/trip/destinationExpansion'
import { localFoodRouteEdits } from './discover-local-food-routes'
import approvedCoverPaths from '../../data/journey-images/approved-cover-paths-2026-09-14.json'
import { reviewedCoverPhotos } from './reviewed-cover-images'

export type ContentSource = 'official' | 'knowledge' | 'user'
export type ContentStatus = 'draft' | 'published' | 'hidden'

export type Poi = { time?: string; period?: string; area?: string; sourceUrl?: string; day?: number; id: string; name: string; cityId: string; latitude?: number; longitude?: number; address?: string; searchKeyword?: string; category: string; image: string; mapProviderId?: string; coordinateSource?: string; verified?: boolean; stay: string; transportation: string; introduction: string; priceState?: 'unknown' | 'estimated'; estimatedBudget?: number }
export type Route = { dayCount?: number; id: string; cityId: string; title: string; summary: string; category: string; tags: string[]; peopleType: string[]; weatherType: string[]; timePeriod: string[]; duration: string; budgetMin: number; budgetMax: number; pois: Poi[]; tips: string[]; recommendedReason: string; cover?: string; coverImage?: JourneyImage; coverImageSource?: JourneyImage['source']; coverImageStatus?: CoverStatus; distanceKm?: number; sourceName?: string; sourceUrl?: string }
export type DiscoverItem = {
  featured?: boolean; id: string; contentSource: ContentSource; authorId?: string; authorName?: string; cityId: string; title: string; subtitle: string; cover: string; category: string; tags: string[]; routeId: string; duration: string; budget: string; poiCount: number; likeCount: number; saveCount: number; useCount: number; publishedAt: string; status: ContentStatus; sourceName?: string; sourceUrl?: string; qualityScore: number; editorScore: number; freshnessScore: number; routeCompletenessScore: number }
export type FeedConfig = { sourceWeights: Record<ContentSource, number>; pageSize: number }

export const discoverFeedConfig: FeedConfig = { sourceWeights: { official: 70, knowledge: 20, user: 10 }, pageSize: 48 }
const imageForPlace = (city: string, placeName: string, fallbackIndex: number) => {
  const gallery = getCityImageGallery(city).filter((image) => image.routeEligible !== false && isUserFacingCover(image.src))
  const sanyaFood = city === '三亚' && /鸡饭|海鲜|清补凉|椰子鸡|抱罗粉|文昌鸡|夜市/.test(placeName)
    ? gallery.find((image) => /海鲜粉|清补凉|鸡饭/.test(`${image.landmark} ${image.alt}`))
    : undefined
  const foodExact = gallery.find((image) => image.kind === 'food' && (placesMatch(image.landmark, placeName) || image.alt.includes(placeName)))
  const exact = gallery.find((image) => placesMatch(image.landmark, placeName) || image.alt.includes(placeName))
  return sanyaFood?.src ?? foodExact?.src ?? exact?.src ?? ''
}
const sanyaFoodLabel = (placeName: string) => /清补凉/.test(placeName)
  ? '清补凉'
  : /椰子鸡/.test(placeName)
    ? '椰子鸡'
    : /鸡饭|文昌鸡/.test(placeName)
      ? '海南鸡饭 / 文昌鸡'
      : /海鲜/.test(placeName)
        ? '海南海鲜'
        : '海南风味'
const isFoodCategory = (item: CityKnowledgeItem) => item.category === 'food' || item.category === 'restaurant'
const concreteFoodForCity = (city: string, offset = 0) => {
  const candidates = (cityKnowledge[city]?.items ?? [])
    .filter((item) => isFoodCategory(item) && isConcreteKnowledgeItem(item) && item.name === item.venueName)
  return candidates[offset % Math.max(1, candidates.length)]
}
const foodKnowledgeForPoi = (city: string, name: string) => {
  const candidates = (cityKnowledge[city]?.items ?? [])
    .filter((item) => isFoodCategory(item) && isConcreteKnowledgeItem(item) && (item.name === name || item.venueName === name))
  const exact = candidates.find((item) => item.name === name)
  const mapped = candidates.find((item) => item.name !== name)
  return exact ?? mapped
}
const foodPoiIntroduction = (item: CityKnowledgeItem) => [
  item.summary,
  item.name === item.venueName ? '' : `推荐门店：${item.venueName ?? item.name}。`,
  item.menuHighlights?.length ? `可点：${item.menuHighlights.join('、')}` : '',
].filter(Boolean).join(' ')
const genericFoodLabel = /晚餐|早餐|午餐|小吃|美食|饭|面|粉|鸡|鸭|鱼|虾|蟹|肉|汤|包子|饺子|米线|冷面|烧烤|火锅|锅|烧饼|粑粑|鱼丸|抓饭|凉粉|凉面|豆腐|糕|菜|清补凉|椰子鸡|鸡架|大救驾|糊|甜茶/
const verifiedRouteCoordinates: Record<string, [number, number][]> = {
  上海: [[121.4396546, 31.2100122], [121.4337292, 31.2062561], [121.4344178, 31.2083571], [121.442273, 31.2166493], [121.4395171, 31.2181135]],
  杭州: [[120.147367, 30.261531], [120.1411727, 30.2597097], [120.1286767, 30.2521659], [120.1181796, 30.2408569], [120.0938589, 30.268683]],
  北京: [[116.3903973, 39.9244589], [116.4063623, 39.9469886], [116.4110049, 39.9455793], [116.4103651, 39.9434824], [116.4904841, 39.9828103]],
  成都: [[104.0548208, 30.6597189], [104.0479169, 30.6677721], [104.0516411, 30.6706369], [104.0863304, 30.6423694], [104.0833515, 30.6441978]],
  广州: [[113.2372814, 23.1097053], [113.2457376, 23.1099977], [113.2422591, 23.1186235], [113.2329007, 23.1175027], [113.2309924, 23.1188908]],
  深圳: [[113.9194304, 22.5403527], [113.9876427, 22.5434178], [113.9879978, 22.5244887], [113.9383043, 22.5148809], [113.9088351, 22.4880191]],
  三亚: [[109.4789, 18.2448], [109.4964, 18.2381], [109.5094, 18.2222], [109.5142, 18.2472], [109.5064, 18.2521]],
}
const routeSeeds = [
  ['上海','武康路慢慢走','从图书馆到梧桐深处，留一整个下午给散步。','约会',['上海图书馆','武康大楼','Ferguson Lane','安福路','乌鲁木齐中路']],
  ['杭州','西湖边慢慢走','沿湖散步、看展和傍晚的湖风。','周末',['断桥残雪','北山街','曲院风荷','茅家埠','天目里']],
  ['北京','胡同与展览的一天','不赶景点，把午后留给一场展览。','Citywalk',['景山公园','五道营胡同','雍和宫','国子监','798艺术区']],
  ['成都','人民公园喝茶','从一杯盖碗茶走到安顺廊桥的夜色。','周末',['人民公园','宽窄巷子','奎星楼街','九眼桥','安顺廊桥']],
  ['广州','沙面到永庆坊','边走边吃，顺着老城区慢慢逛。','聚餐',['沙面岛','芳记小食店','上下九','永庆坊','富记鱼蛋粉']],
  ['深圳','南头到深圳湾','城中村、海边和日落都放进同一天。','周末',['南头古城','华侨城创意园','深圳湾公园','人才公园','海上世界']],
  ['三亚','三亚慢慢走','从椰梦长廊走到三亚湾夜景，把海风、日落和一段滨海散步放进同一天。','Citywalk',['椰梦长廊','凤凰岛海边','鹿回头风景区','大东海海滩','三亚湾夜景']],
  ['三亚','三亚逛吃一条线','从第一市场吃到大东海，把海南鸡饭、清补凉、椰子鸡和海鲜安排在具体门店。','聚餐',['阿浪海鲜','沿江海南鸡饭店','椰语堂清补凉','嗲嗲的椰子鸡（大东海店）','不仔客海鲜（大东海店）']],
  ['三亚','三亚看海不赶路','天涯镇到西岛，把完整的下午留给海岸线和热带小岛。','旅行',['天涯镇','天涯海角','西岛码头','西岛海滩','椰梦长廊']],
] as const

const seededRoutes: Route[] = routeSeeds.map(([city, title, summary, category, names], routeIndex) => {
  const coordinates = verifiedRouteCoordinates[city]
  return {
    id: `route-${routeIndex + 1}`,
    cityId: city,
    title,
    summary,
    category,
    tags: category === '聚餐' ? [category, '本地美食', '边走边吃'] : [category, '慢慢走'],
    peopleType: category === '约会' ? ['情侣', '朋友'] : category === '聚餐' ? ['朋友', '同事'] : ['朋友', '独自'],
    weatherType: ['晴天', '阴天'],
    timePeriod: ['下午', '周末'],
    duration: city === '三亚' && category === '聚餐' ? '5h' : routeIndex === 0 ? '4.5h' : '4h',
    budgetMin: category === '聚餐' ? 180 : 120,
    budgetMax: category === '聚餐' ? 360 : 220,
    cover: imageForPlace(city, names[0], routeIndex),
    pois: names.map((name, index) => {
      const coordinate = coordinates?.[index]
      const foodItem = foodKnowledgeForPoi(city, name)
      const isFood = Boolean(foodItem) || /鸡饭|清补凉|椰子鸡|海鲜|夜市/.test(name)
      const transportation = city !== '三亚'
        ? (index ? '步行路线待服务核验' : '从这里开始')
        : category === '聚餐'
          ? (index === 0 ? '从市区出发，打车约 10 分钟' : index === 1 ? '步行约 6 分钟' : index === 2 ? '步行约 8 分钟' : index === 3 ? '打车约 12 分钟' : '步行约 5 分钟')
          : title.includes('看海')
            ? (index === 0 ? '从三亚湾海边入口开始' : index === 1 ? '沿海岸步道步行约 1.2 km' : index === 2 ? '打车约 12 分钟到山脚，再乘接驳' : index === 3 ? '打车约 10 分钟' : '沿海岸步道步行约 8 分钟')
            : (index === 0 ? '从三亚湾海边入口开始' : index === 1 ? '沿滨海步道步行约 18 分钟' : index === 2 ? '打车约 12 分钟到山脚，再乘接驳' : index === 3 ? '打车约 10 分钟' : '沿海岸步道步行约 8 分钟')
      const stay = isFood
        ? city === '三亚'
          ? /海鲜/.test(name) ? '60min' : /椰子鸡/.test(name) ? '70min' : /清补凉/.test(name) ? '35min' : '45min'
          : '45min'
        : index === 2 ? '50min' : '35min'
      const imageName = city === '上海' && name === 'Ferguson Lane' ? '武康路' : name
      return {
        id: `poi-${routeIndex + 1}-${index + 1}`,
        name,
        cityId: city,
        ...(coordinate ? { latitude: coordinate[1], longitude: coordinate[0] } : {}),
        ...(coordinate ? { coordinateSource: '走走地点资料 · 坐标已核验' } : {}),
        searchKeyword: `${city} ${name}`,
        category: isFood ? '餐饮' : index === 2 ? '咖啡 / 休息' : '地点',
        image: imageForPlace(city, imageName, category === '聚餐' ? index + 3 : index),
        mapProviderId: undefined,
        verified: Boolean(coordinate),
        stay,
        transportation,
        introduction: foodItem
          ? foodPoiIntroduction(foodItem)
          : isFood
            ? `在${name}品尝${sanyaFoodLabel(name)}，按这段路线的节奏慢慢吃。`
            : `在${name}停留一会，按自己的节奏感受${city}。`,
      }
    }),
    tips: ['地点按同一片区串联，预算按人均区间估算。', '热门时段建议预留等候时间。'],
     recommendedReason: coordinates ? '地点顺序使用已核验地点资料；真实道路请打开地图 App 计算。' : '地点顺序待核验；打开某一站的地图 App 后再确认道路。',
  }
})

const fallbackRoutes: Route[] = Object.keys(cityProfiles)
  .filter((city) => isRuntimeCityAllowed(city) && !routeSeeds.some(([seedCity]) => seedCity === city))
  .map((city, index) => {
  const profile = getCityProfile(city)
  const foodVenue = concreteFoodForCity(city)
  const profileNames = profile.demoLabels.slice(0, 5)
  const names = foodVenue
    ? profileNames.map((name) => genericFoodLabel.test(name) ? foodVenue.name : name)
    : profileNames
  const routeNames = foodVenue && !names.some((name) => name === foodVenue.name)
    ? [...names, foodVenue.name]
    : names
  return {
    id: `route-city-${index + 1}`,
    cityId: city,
    title: `${city}慢慢走`,
    summary: `从${routeNames[0]}走到${routeNames.at(-1)}，把当地风景、休息和一顿好饭放进同一天。`,
    category: '周末',
    tags: ['周末', '慢慢走'],
    peopleType: ['朋友', '独自'],
    weatherType: ['晴天', '阴天'],
    timePeriod: ['上午', '下午', '周末'],
    duration: '4h',
    budgetMin: 100,
    budgetMax: 220,
    pois: routeNames.map((name, poiIndex) => {
      const foodItem = foodKnowledgeForPoi(city, name)
      const isFood = Boolean(foodItem)
      return {
      id: `poi-city-${index + 1}-${poiIndex + 1}`,
      name,
      cityId: city,
       searchKeyword: `${city} ${name}`,
      category: isFood ? '餐饮' : poiIndex === 2 ? '咖啡 / 休息' : '地点',
      image: imageForPlace(city, name, poiIndex),
       coordinateSource: '走走地点资料 · 坐标待核验',
      verified: false,
      stay: isFood ? '45min' : poiIndex === 2 ? '50min' : '35min',
       transportation: poiIndex ? '前往方式待确认' : '从这里开始',
      introduction: foodItem ? foodPoiIntroduction(foodItem) : `在${name}停留一会，按自己的节奏感受${city}。`,
      }
    }),
    tips: ['地点按相邻片区组织，减少折返。', '热门时段建议预留等候时间。'],
    recommendedReason: '地点顺序按相邻区域组织，走起来不需要折返。',
    cover: imageForPlace(city, names[0], index),
  }
})

const uniqueKnowledgeItems = (items: CityKnowledgeItem[]) => {
  const names = new Set<string>()
  return items.filter((item) => {
    if (names.has(item.name) || item.coordinates?.every((value) => value === 0)) return false
    names.add(item.name)
    return true
  })
}

const durationLabel = (items: CityKnowledgeItem[]) => `约${Math.max(2, Math.round((items.reduce((total, item) => total + item.durationMinutes, 0) + 30) / 60))}h`

type RouteTheme = { label: string; category: string; match: RegExp; timePeriods: string[] }

const routeThemes: RouteTheme[] = [
  { label: '经典地标', category: '旅行', match: /经典|核心看点|城市地标|景点|人文/, timePeriods: ['上午', '周末'] },
  { label: '城市漫步', category: 'Citywalk', match: /城市漫步|街区|老街|老城|City Walk/, timePeriods: ['上午', '下午'] },
  { label: '博物馆与展览', category: '旅行', match: /展览|博物馆|美术馆|室内/, timePeriods: ['上午', '下午'] },
  { label: '自然风景', category: '旅行', match: /自然|湖景|湿地|山地|森林|峰林|公园/, timePeriods: ['上午', '下午'] },
  { label: '历史建筑', category: 'Citywalk', match: /历史|建筑|遗址|城墙|寺院|古镇/, timePeriods: ['上午', '下午'] },
  { label: '夜景路线', category: '约会', match: /夜景|夜逛|灯光|日落|滨江|夜游/, timePeriods: ['傍晚', '夜间'] },
  { label: '本地逛吃', category: '聚餐', match: /逛吃|美食|小吃|餐馆|餐饮|菜馆/, timePeriods: ['午餐', '晚餐'] },
  { label: '早市与菜场', category: '聚餐', match: /早市|早餐|菜市场|菜场|过早|市井/, timePeriods: ['早上', '上午'] },
  { label: '本地人生活', category: 'Citywalk', match: /本地人项目|本地生活|晨练|茶馆|咖啡|书店/, timePeriods: ['上午', '下午'] },
  { label: '亲子半日', category: '周末', match: /亲子|动物园|游乐园|主题乐园|科技馆/, timePeriods: ['上午', '下午'] },
  { label: '茶与慢生活', category: '周末', match: /茶|休息|园林|咖啡|温泉|慢走/, timePeriods: ['下午', '周末'] },
  { label: '远郊半日', category: '旅行', match: /远郊|半日|一日|郊游|湿地|古镇/, timePeriods: ['上午', '周末'] },
  { label: '拍照出片', category: '约会', match: /拍照|摄影|出片|建筑|观景/, timePeriods: ['下午', '傍晚'] },
  { label: '特色美食', category: '聚餐', match: /本地小吃|本地美食|本地餐馆|正餐|面食|点心/, timePeriods: ['午餐', '晚餐'] },
  { label: '雨天备选', category: '周末', match: /室内|展览|博物馆|美术馆|书店|休息/, timePeriods: ['上午', '下午'] },
]

const itemSearchText = (item: CityKnowledgeItem) => [item.name, item.category, item.area, ...item.tags].join(' ')
const areaTokens = (area: string) => area.split(/[ /—，、·-]+/).filter((token) => token.length >= 2)
const sharesArea = (left: CityKnowledgeItem, right: CityKnowledgeItem) => {
  const leftArea = left.area
  const rightArea = right.area
  return leftArea === rightArea || areaTokens(leftArea).some((token) => rightArea.includes(token)) || areaTokens(rightArea).some((token) => leftArea.includes(token))
}

const anchorScore = (item: CityKnowledgeItem, theme: RouteTheme, usage: Map<string, number>) => {
  const text = itemSearchText(item)
  const categoryBoost = theme.category === '聚餐' && (item.category === 'food' || item.category === 'restaurant')
    ? 25
    : theme.category !== '聚餐' && item.category === 'attraction' ? 12 : 0
  return (theme.match.test(text) ? 100 : 0) + categoryBoost - (usage.get(item.name) ?? 0) * 8
}

const companionScore = (item: CityKnowledgeItem, anchor: CityKnowledgeItem, theme: RouteTheme, usage: Map<string, number>) => {
  const text = itemSearchText(item)
  const sameAreaScore = sharesArea(anchor, item) ? 45 : 0
  const themeScore = theme.match.test(text) ? 20 : 0
  const complementaryScore = anchor.category === 'attraction' && (item.category === 'food' || item.category === 'restaurant')
    ? 18
    : (anchor.category === 'food' || anchor.category === 'restaurant') && (item.category === 'attraction' || item.category === 'activity') ? 18 : 0
  return sameAreaScore + themeScore + complementaryScore - (usage.get(item.name) ?? 0) * 6
}

const knowledgeRouteGroups = (items: CityKnowledgeItem[]) => {
  // Breakfast-only additions enter explicitly reviewed morning sequences below,
  // not arbitrary dinner/night templates selected by the generic theme scorer.
  const editorialNames = new Set(Object.values(destinationExpansion).flat().map(item=>item.name))
  const candidates = uniqueKnowledgeItems(items).filter(item=>!item.tags.includes('早餐专用') && !editorialNames.has(item.name)).filter((item) => item.category !== 'food' && item.category !== 'restaurant' || isConcreteKnowledgeItem(item))
  const usedAnchors = new Set<string>()
  const usage = new Map<string, number>()
  const selectedGroups: CityKnowledgeItem[][] = []
  const groupOverlap = (left: CityKnowledgeItem[], right: CityKnowledgeItem[]) => left.filter((item) => right.some((other) => other.name === item.name)).length / Math.max(left.length, right.length)
  return routeThemes.flatMap((requestedTheme) => {
    // Without a named venue this is a neighborhood exploration, not a dining route.
    const theme = requestedTheme.category === '聚餐' && !candidates.some(isFoodCategory)
      ? {...requestedTheme, category: 'Citywalk', label: requestedTheme.label === '本地逛吃' ? '街区生活' : requestedTheme.label === '特色美食' ? '地方文化' : requestedTheme.label}
      : requestedTheme
    const available = candidates.filter((item) => !usedAnchors.has(item.name))
    const anchorPool = available.length > 0 ? available : candidates
    const anchor = [...anchorPool].sort((left, right) => anchorScore(right, theme, usage) - anchorScore(left, theme, usage))[0]
    if (!anchor) return []
    usedAnchors.add(anchor.name)
    const companionPool = candidates
      .filter((item) => item.name !== anchor.name)
      .sort((left, right) => companionScore(right, anchor, theme, usage) - companionScore(left, anchor, theme, usage))
    const pool = companionPool.slice(0, 12)
    let group: CityKnowledgeItem[] | undefined
    for (let leftIndex = 0; leftIndex < pool.length && !group; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pool.length; rightIndex += 1) {
        const candidateGroup = [anchor, pool[leftIndex], pool[rightIndex]]
        if (!selectedGroups.some((selected) => groupOverlap(candidateGroup, selected) > .7)) {
          group = candidateGroup
          break
        }
      }
    }
    group ??= [anchor, ...pool.slice(0, 2)]
    selectedGroups.push(group)
    for (const item of group) usage.set(item.name, (usage.get(item.name) ?? 0) + 1)
    return [{ theme, items: group }]
  })
}

const officialRoutes: Route[] = [...seededRoutes, ...fallbackRoutes]

const buildKnowledgeRoutes = (city: string, items: CityKnowledgeItem[]): Route[] => {
  return knowledgeRouteGroups(items).map(({ theme, items: group }, index) => {
    const edit = [...breakfastRouteEdits,...localFoodRouteEdits].find(entry => entry.city===city && entry.anchor===group[0].name)
    const editedItems=edit?.names.map(name=>items.find(item=>item.name===name))
    const appliedEdit=editedItems?.every((item):item is CityKnowledgeItem=>Boolean(item)) ? edit : undefined
    if(appliedEdit && editedItems)group=editedItems as CityKnowledgeItem[]
    const isMorningEdit=Boolean(appliedEdit && !('timePeriods' in appliedEdit))
    if(isMorningEdit)group=group.map((item,i)=>i===0?{...item,durationMinutes:20}:item)
    const first = group[0]
    const last = group.at(-1) ?? first
    const minBudget = group.reduce((total, item) => total + (item.price.unit === 'night' ? 0 : item.price.min), 0)
    const maxBudget = group.reduce((total, item) => total + (item.price.unit === 'night' ? 0 : item.price.max), 0)
    const source = group.find((item) => item.source.kind !== 'amap')?.source ?? first.source
    return {
      id: `knowledge-route-${city}-${index + 1}`,
      cityId: city,
      title: appliedEdit?.title ?? `${city}${theme.label} · ${first.name}`,
      summary: appliedEdit?.summary ?? `围绕${first.name}，串起${group.slice(1).map((item) => item.name).join('、') || last.name}；出发前按实际交通确认衔接。`,
      category: theme.category,
      tags: [...new Set([theme.category, theme.label, '城市精选', ...group.flatMap((item) => item.tags)])].slice(0, 7),
      peopleType: theme.category === '约会' ? ['情侣', '朋友'] : theme.category === '聚餐' ? ['朋友', '同事'] : ['朋友', '独自'],
      weatherType: ['晴天', '阴天'],
      timePeriod: appliedEdit ? ('timePeriods' in appliedEdit ? [...appliedEdit.timePeriods] : ['早上','上午']) : theme.timePeriods,
      duration: durationLabel(group),
      budgetMin: minBudget,
      budgetMax: Math.max(maxBudget, minBudget),
      pois: group.map((item, poiIndex) => {
        const coordinates = item.verified ? getPlaceCoordinates({ coordinates: item.coordinates, coordinateSystem: item.coordinateSystem }) : null
        return {
        id: `poi-${city}-${index + 1}-${poiIndex + 1}`,
        name: item.name,
        area: item.area, sourceUrl: item.source.url,
        cityId: city,
        ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
        ...(item.address ? { address: item.address } : {}),
        searchKeyword: item.searchKeyword ?? `${city} ${item.venueName ?? item.name}`,
        category: item.category,
        priceState: item.price.state ?? 'estimated',
        estimatedBudget: item.price.state==='unknown' ? undefined : Math.round((item.price.min+item.price.max)/2),
        image: imageForPlace(city, item.name, index + poiIndex),
        ...(item.verified ? { coordinateSource: `${item.source.label} · ${item.source.checkedAt}` } : {}),
        verified: item.verified,
        stay: `${item.durationMinutes}min`,
        transportation: poiIndex === 0 ? '从这里开始' : '打开手机地图选择交通方式',
        introduction: isFoodCategory(item) ? foodPoiIntroduction(item) : item.summary,
      }
      }),
      tips: [appliedEdit?.tip ?? '根据当天体力减少补充停留，不压缩主要体验和用餐。', '出发前确认预约、营业和临时调整；实际转场请打开手机地图。', ...(group.some(item=>item.price.state==='unknown') ? ['部分餐饮价格未确认，未计金额不代表免费。'] : ['费用为参考区间，实际以现场为准。'])],
      recommendedReason: appliedEdit?.summary ?? `围绕${theme.label}安排，优先串联同一片区的地点，减少折返。`,
      cover: imageForPlace(city, first.name, index),
      sourceName: `${city}城市知识库`,
      sourceUrl: source.url,
    }
  })
}

const knowledgeRoutes: Route[] = Object.entries(cityKnowledge)
  .filter(([city]) => isRuntimeCityAllowed(city))
  .flatMap(([city, knowledge]) => buildKnowledgeRoutes(city, knowledge.items))

const multiDayRoutes = cityNames.flatMap(city => buildMultiDayRoutes(city, knowledgeRoutes.filter(route => route.cityId === city)))
type RouteCoverCandidate = { src: string; placeName: string; source?: JourneyImage['source']; image?: JourneyImage }
const isDiningPoi = (poi: Poi) => /早餐|午餐|晚餐|餐饮|餐厅|小吃|restaurant|food/.test(poi.category)
const visuallyReviewedCovers = new Set([...approvedCoverPaths, ...reviewedCoverPhotos.map(photo => photo.src)])
const indexedCoversByCity = new Map<string, JourneyImage[]>()
for (const selection of Object.values(discoverCoverIndex)) {
  const photo = selection.image
  if (!photo || !isUserFacingCover(photo.cachedUrl) || !visuallyReviewedCovers.has(photo.cachedUrl)) continue
  const gallery = indexedCoversByCity.get(photo.city) ?? []
  if (!gallery.some(other => other.cachedUrl === photo.cachedUrl)) gallery.push(photo)
  indexedCoversByCity.set(photo.city, gallery)
}
const coverUses = new Map<string, number>()
const coverPlaces = new Map<string, string>()
const attachJourneyCover = (route: Route): Route => {
  // Multi-day travel covers show a place in the trip, not the first breakfast.
  const places = route.dayCount ? route.pois.filter(poi => !isDiningPoi(poi))
    : route.category === '聚餐' ? route.pois.filter(isDiningPoi) : route.pois
  const matches = (name: string) => places.some(poi => placesMatch(name, poi.name))
  const candidates: RouteCoverCandidate[] = getCityImageGallery(route.cityId)
    .filter(photo => photo.routeEligible !== false && isUserFacingCover(photo.src) && visuallyReviewedCovers.has(photo.src) && matches(photo.landmark) && (!route.dayCount || photo.kind !== 'food'))
    .map(photo => ({ src: photo.src, placeName: photo.landmark, source: photo.sourceUrl.includes('wikimedia.org') ? 'wikimedia' : undefined }))
  candidates.push(...authorizedSocialPhotos.filter(photo => visuallyReviewedCovers.has(photo.localPath) && photo.city === route.cityId && matches(photo.placeName) && (!photo.routeIds.length || photo.routeIds.includes(route.id)))
    .map(photo => ({ src: photo.localPath, placeName: photo.placeName, source: 'xiaohongshu' as const })))
  for (const indexed of indexedCoversByCity.get(route.cityId) ?? []) {
    if (!matches(indexed.placeName ?? '') || route.dayCount && (indexed.kind === 'food' || indexed.category === 'dining')) continue
    candidates.push({ src: indexed.cachedUrl, placeName: indexed.placeName ?? '', source: indexed.source, image: indexed })
  }
  // A dining-heavy short trip can use its actual meal photo if no reviewed
  // sightseeing photo exists; never borrow an unrelated city landmark.
  if (!candidates.length && route.dayCount) {
    for (const photo of indexedCoversByCity.get(route.cityId) ?? []) {
      if (route.pois.some(poi => isDiningPoi(poi) && placesMatch(photo.placeName, poi.name))) {
        candidates.push({src:photo.cachedUrl,placeName:photo.placeName ?? '',source:photo.source,image:photo})
      }
    }
  }
  const unique = candidates.filter((photo, index) => candidates.findIndex(other => other.src === photo.src) === index)
  const score = (photo: RouteCoverCandidate) => (route.title.includes(photo.placeName) ? 20 : 0)
    + (photo.src.includes('/cover-refresh/') ? 12 : 0) - (coverUses.get(coverVisualIdentity(photo.src)) ?? 0) * 16
  const selected = unique.sort((a, b) => score(b) - score(a))[0]
  if (!selected) return { ...route, cover: '', coverImage: undefined, coverImageSource: undefined, coverImageStatus: 'fallback' }
  const identity = coverVisualIdentity(selected.src)
  coverUses.set(identity, (coverUses.get(identity) ?? 0) + 1)
  coverPlaces.set(route.id, normalizePlaceName(selected.placeName))
  return { ...route, cover: selected.src, coverImage: selected.image, coverImageSource: selected.source, coverImageStatus: 'ready' }
}

/** Image assignment is prepared at build time from the local, attribution-backed cache. */
export const routes: Route[] = [...officialRoutes, ...knowledgeRoutes, ...multiDayRoutes].map((route) => {
  return attachJourneyCover({...route, pois:route.pois.map(poi => ({...poi, image:reviewedPhotoForPlace(route.cityId,poi.name)?.localPath ?? poi.image}))})
})

const item = (route: Route, contentSource: ContentSource, suffix: string, score: number): DiscoverItem => {
  const cover = typeof route.cover === 'string' && isUserFacingCover(route.cover) ? route.cover : ''
  const userCover = contentSource === 'user'
    ? route.pois.find((poi) => poi.image !== cover && isUserFacingCover(poi.image))?.image ?? cover
    : cover
  return { id: `post-${route.id}-${suffix}`, contentSource, authorId: contentSource === 'user' ? 'user-xiaopeng' : undefined, authorName: contentSource === 'user' ? '小鹏' : undefined, cityId: route.cityId, title: route.title, subtitle: route.summary, cover: userCover, category: route.category, tags: route.tags, routeId: route.id, duration: route.duration, budget: route.dayCount ? '地点费用参考，住宿交通另计' : `¥${route.budgetMin}-${route.budgetMax}/人`, poiCount: route.pois.length, likeCount: 0, saveCount: 0, useCount: 0, publishedAt: '2026-08-28', status: 'published', sourceName: contentSource === 'knowledge' ? route.sourceName ?? `${route.cityId}城市攻略知识库` : undefined, sourceUrl: contentSource === 'knowledge' ? route.sourceUrl : undefined, qualityScore: score, editorScore: score + 2, freshnessScore: 82, routeCompletenessScore: 94 }
}

export const getRoute = (id: string) => routes.find((route) => route.id === id)
export const createUserDiscoverItem = (route: Route, overrides?: Partial<Pick<DiscoverItem, 'title' | 'subtitle' | 'cover' | 'publishedAt'>>): DiscoverItem => ({ ...item(route, 'user', 'shared', 76), ...overrides })
const staticUserItems: DiscoverItem[] = []
const officialRouteIds = new Set(officialRoutes.map((route) => route.id))
const officialItems = routes.filter((route) => officialRouteIds.has(route.id)).map((route, index) => item(route, 'official', 'official', 90 - index))
const knowledgeItems = routes.filter((route) => !officialRouteIds.has(route.id)).map((route, index) => item(route, 'knowledge', 'knowledge', 88 - (index % 10)))

export const discoverItems: DiscoverItem[] = [...officialItems, ...knowledgeItems, ...staticUserItems]

export const getDiscoverItem = (id: string) => {
  const existing = discoverItems.find((entry) => entry.id === id)
  if (existing) return existing
  return undefined
}
export const rankScore = (entry: DiscoverItem) => entry.qualityScore * .3 + entry.editorScore * .3 + entry.routeCompletenessScore * .25 + entry.freshnessScore * .15
const overlaps = (a: Route, b: Route) => a.pois.filter((poi) => b.pois.some((other) => other.name === poi.name)).length / Math.max(a.pois.length, b.pois.length)
// The same places on different days or in a different order are distinct plans.
const itinerarySignature = (route: Route) => JSON.stringify([route.dayCount, route.pois.map(poi => [poi.day, poi.name, poi.time])])
export const getCityTopGuides = (cityId: string, limit = 40) => {
  const sorted = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'knowledge' && entry.status === 'published').sort((a, b) => rankScore(b) - rankScore(a))
  const distinct = sorted.reduce<DiscoverItem[]>((kept, candidate) => {
    const route = getRoute(candidate.routeId)
    if (!route || kept.some((entry) => { const keptRoute = getRoute(entry.routeId); return keptRoute && (route.dayCount || keptRoute.dayCount ? itinerarySignature(route) === itinerarySignature(keptRoute) : overlaps(route, keptRoute) > .7) })) return kept
    return [...kept, candidate]
  }, [])
  const dayLeaders = [2, 3, 4, 1].flatMap(days => {
    const entry = distinct.find(item => getRoute(item.routeId)?.dayCount === days)
    return entry ? [entry] : []
  })
  return [...dayLeaders, ...distinct.filter(entry => !dayLeaders.includes(entry))].slice(0, limit)
}

export const getDiscoverFeed = (cityId: string, config = discoverFeedConfig, publishedRouteIds: string[] = []) => {
  const official = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'official')
  const knowledge = getCityTopGuides(cityId)
  const published = publishedRouteIds
    .map((routeId) => getRoute(routeId))
    .filter((route): route is Route => Boolean(route && route.cityId === cityId))
    .map((route) => createUserDiscoverItem(route))
  const user = [...discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'user'), ...published]
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.routeId === entry.routeId) === index)
  const publishedIds = new Set(user.map(entry => entry.routeId))
  const feed: DiscoverItem[] = []
  for (const entry of [...official, ...knowledge].filter(entry => !publishedIds.has(entry.routeId)).slice(0, Math.max(0, config.pageSize - user.length)).concat(user)) {
    if (feed.length >= config.pageSize) break
    const route = getRoute(entry.routeId)
    // Cover selection already matches a sourced place. Do not discard a route
    // because its photo is reused or absent, or infer food content from filenames.
    const cover = entry.contentSource === 'user' ? entry.cover : route?.cover
    const chosenCover = isUserFacingCover(cover) ? cover! : ''
    feed.push(chosenCover === entry.cover ? entry : { ...entry, cover: chosenCover })
  }
  const firstCovers = new Set<string>()
  const orderedFeed = [...feed.filter(entry => { if (firstCovers.has(entry.cover)) return false; firstCovers.add(entry.cover); return true }), ...feed.filter((entry, index) => feed.findIndex(other => other.cover === entry.cover) !== index)]
  return [...orderedFeed.filter(entry => entry.contentSource !== 'user'), ...orderedFeed.filter(entry => entry.contentSource === 'user')]
}

export type ExploreCityCard = {
  cityId: string
  name: string
  cover: string
  landmark: string
  intro: string
  guideCount: number
  publishedRouteCount: number
  updatedAt: string
  tags: string[]
}

/** City index used by Explore > 探索. Covers and guide counts come from the
 * same data sources as route cards, so a city cannot appear as an empty shell. */
export const getExploreCityCards = (query = ''): ExploreCityCard[] => {
  const keyword = normalizeCityQuery(query)
  const visibleRoutes = getItineraryPlazaItems()
  return cityNames
    .filter((city) => !keyword || city.toLowerCase().includes(keyword))
    .map((city) => {
      const image = getCityImageGallery(city)[0]
      const knowledge = cityKnowledge[city]
      const profile = getCityProfile(city)
      return {
        cityId: city,
        name: city,
        cover: authorizedSocialPhotos.find(photo => photo.city === city)?.localPath ?? image?.src ?? '',
        landmark: authorizedSocialPhotos.find(photo => photo.city === city)?.placeName ?? image?.landmark ?? profile.demoLabels[0] ?? city,
        intro: knowledge?.intro ?? `${city}的代表性景点、街区和本地吃法。`,
        guideCount: getItineraryPlazaItems(city).length,
        publishedRouteCount: visibleRoutes.filter(item=>item.cityId===city).length,
        updatedAt: '2026-09-05',
        tags: profile.demoLabels.slice(0, 3),
      }
    })
}

/** National itinerary plaza: keep one ranked route from every supported city
 * in the national feed, then fill the remaining slots with varied routes. */
const featuredGuidesForCity = (entries: DiscoverItem[]) => {
  const score = (entry: DiscoverItem) => {
    const route = getRoute(entry.routeId)!
    const places = route.pois
    return places.filter(poi => poi.sourceUrl && poi.introduction.length >= 30).length * 4
      + new Set(places.map(poi => poi.area)).size * 2
      + places.filter(poi => poi.category === 'attraction').length * 3
      - places.filter(poi => /早走|晨逛|夜逛/.test(poi.name)).length
  }
  const ranked = [...entries].sort((a,b) => score(b)-score(a) || a.routeId.localeCompare(b.routeId))
  const selected: DiscoverItem[] = []
  for (const days of [3, 4, 2, 1]) {
    const entry = ranked.find(item => getRoute(item.routeId)?.dayCount === days)
    if (entry) selected.push(entry)
  }
  const extra = ranked.find(item => !selected.includes(item))
  if (extra) selected.push(extra)
  return new Set(selected.map(item => item.routeId))
}

/** Exact editorial corpus: 20 multiday guides per city; five featured per city.
 * Interleave cities so pagination does not hide later cities behind one city's list. */
export const getItineraryPlazaItems = (cityId?: string, limit = 1200, featuredOnly = false): DiscoverItem[] => {
  const groups = (cityId ? [cityId] : cityNames).map(city => {
    const catalog = getCityTopGuides(city, 100).filter(item => Boolean(getRoute(item.routeId)?.dayCount))
    const entries = ([ [3,8], [4,8], [2,3], [1,1] ] as const).flatMap(([days,count]) => catalog.filter(item => getRoute(item.routeId)?.dayCount === days).slice(0,count))
    const featured = featuredGuidesForCity(entries)
    return entries.map(item => ({...item, featured: featured.has(item.routeId)})).filter(item => !featuredOnly || item.featured)
  })
  return Array.from({length:20}, (_,index) => groups.flatMap(group => group[index] ? [group[index]] : [])).flat().slice(0,limit)
}

/** Home recommends distinct photographed places, with a cover from each route. */
export function getHomeGuideRecommendations(city: string, limit = 3): DiscoverItem[] {
  const preferred = getItineraryPlazaItems(city, 20, true)
  const remaining = getItineraryPlazaItems(city, 20).filter(item => !preferred.some(other => other.id === item.id))
  const selected: DiscoverItem[] = []
  const covers = new Set<string>()
  const places = new Set<string>()
  for (const entry of [...preferred, ...remaining]) {
    const identity = coverVisualIdentity(entry.cover)
    const place = coverPlaces.get(entry.routeId) ?? identity
    if (!isUserFacingCover(entry.cover) || covers.has(identity) || places.has(place)) continue
    covers.add(identity)
    places.add(place)
    selected.push(entry)
    if (selected.length === limit) break
  }
  return selected
}

export function normalizeCityQuery(value: string) { const q=value.trim().toLowerCase().replace(/市$/, ''); return ({shanghai:'上海',chengdu:'成都',dali:'大理',大理白族自治州:'大理'} as Record<string,string>)[q] ?? q }

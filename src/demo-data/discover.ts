import { getCityImageGallery } from './city-images'
import { cityProfiles, getCityProfile } from './cities'
import { cityKnowledge, isConcreteKnowledgeItem, type CityKnowledgeItem } from '../services/trip/cityKnowledge'
import { isUserFacingCover, placesMatch, selectJourneyCover, type CoverStatus, type JourneyImage } from '../services/journey-images'

export type ContentSource = 'official' | 'knowledge' | 'user'
export type ContentStatus = 'draft' | 'published' | 'hidden'

export type Poi = { id: string; name: string; cityId: string; latitude: number; longitude: number; address: string; category: string; image: string; mapProviderId?: string; coordinateSource?: string; verified?: boolean; stay: string; transportation: string; introduction: string }
export type Route = { id: string; cityId: string; title: string; summary: string; category: string; tags: string[]; peopleType: string[]; weatherType: string[]; timePeriod: string[]; duration: string; budgetMin: number; budgetMax: number; pois: Poi[]; tips: string[]; recommendedReason: string; cover?: string; coverImage?: JourneyImage; coverImageSource?: JourneyImage['source']; coverImageStatus?: CoverStatus; distanceKm?: number; sourceName?: string; sourceUrl?: string }
export type DiscoverItem = { id: string; contentSource: ContentSource; authorId?: string; authorName?: string; cityId: string; title: string; subtitle: string; cover: string; category: string; tags: string[]; routeId: string; duration: string; budget: string; poiCount: number; likeCount: number; saveCount: number; useCount: number; publishedAt: string; status: ContentStatus; sourceName?: string; sourceUrl?: string; qualityScore: number; editorScore: number; freshnessScore: number; routeCompletenessScore: number }
export type FeedConfig = { sourceWeights: Record<ContentSource, number>; pageSize: number }

export const discoverFeedConfig: FeedConfig = { sourceWeights: { official: 70, knowledge: 20, user: 10 }, pageSize: 20 }
const cityCoordinates: Record<string, [number, number]> = { 上海: [121.44, 31.21], 杭州: [120.16, 30.25], 北京: [116.40, 39.91], 成都: [104.07, 30.67], 广州: [113.27, 23.13], 深圳: [114.06, 22.54], 三亚: [109.51, 18.25] }
const imageForPlace = (city: string, placeName: string, fallbackIndex: number) => {
  const gallery = getCityImageGallery(city).filter((image) => isUserFacingCover(image.src))
  const sanyaFood = city === '三亚' && /鸡饭|海鲜|清补凉|椰子鸡|抱罗粉|文昌鸡|夜市/.test(placeName)
    ? gallery.find((image) => /海鲜粉|清补凉|鸡饭/.test(`${image.landmark} ${image.alt}`))
    : undefined
  const exact = gallery.find((image) => placesMatch(image.landmark, placeName) || image.alt.includes(placeName))
  return sanyaFood?.src ?? exact?.src ?? gallery[fallbackIndex % gallery.length]?.src ?? gallery[0]?.src ?? ''
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
  const [longitude, latitude] = cityCoordinates[city]
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
    distanceKm: city === '三亚' ? (category === '聚餐' ? 3.8 : 7.6) : undefined,
    cover: imageForPlace(city, names[0], routeIndex),
    pois: names.map((name, index) => {
      const [poiLongitude, poiLatitude] = coordinates?.[index] ?? [longitude + index * .003, latitude + index * .003]
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
        latitude: poiLatitude,
        longitude: poiLongitude,
        address: `${city}${name}`,
        category: isFood ? '餐饮' : index === 2 ? '咖啡 / 休息' : '地点',
        image: imageForPlace(city, imageName, category === '聚餐' ? index + 3 : index),
        mapProviderId: undefined,
        coordinateSource: coordinates ? 'OpenStreetMap Nominatim · 2026-08-30' : undefined,
        verified: Boolean(coordinates),
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
    recommendedReason: coordinates ? '地点顺序使用已核验坐标，步行几何由路线服务返回。' : '地点顺序待核验，路线服务返回前不宣称可直接执行。',
  }
})

const fallbackRoutes: Route[] = Object.keys(cityProfiles).filter((city) => !routeSeeds.some(([seedCity]) => seedCity === city)).map((city, index) => {
  const profile = getCityProfile(city)
  const [longitude, latitude] = profile.mapCenter
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
      latitude: latitude + poiIndex * .003,
      longitude: longitude + poiIndex * .003,
      address: `${city}${name}`,
      category: isFood ? '餐饮' : poiIndex === 2 ? '咖啡 / 休息' : '地点',
      image: imageForPlace(city, name, poiIndex),
      coordinateSource: '城市候选骨架；坐标待 POI 核验',
      verified: false,
      stay: isFood ? '45min' : poiIndex === 2 ? '50min' : '35min',
      transportation: poiIndex ? '步行约 12 分钟' : '从这里开始',
      introduction: foodItem ? foodPoiIntroduction(foodItem) : `在${name}停留一会，按自己的节奏感受${city}。`,
      }
    }),
    tips: ['地点按相邻片区组织，减少折返。', '热门时段建议预留等候时间。'],
    recommendedReason: '地点顺序按相邻区域组织，走起来不需要折返。',
    cover: imageForPlace(city, names[0], index),
    distanceKm: 5.2,
  }
})

const uniqueKnowledgeItems = (items: CityKnowledgeItem[]) => {
  const names = new Set<string>()
  return items.filter((item) => {
    if (names.has(item.name) || item.coordinates.every((value) => value === 0)) return false
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
  const candidates = uniqueKnowledgeItems(items).filter((item) => item.category !== 'food' && item.category !== 'restaurant' || isConcreteKnowledgeItem(item))
  const usedAnchors = new Set<string>()
  const usage = new Map<string, number>()
  const selectedGroups: CityKnowledgeItem[][] = []
  const groupOverlap = (left: CityKnowledgeItem[], right: CityKnowledgeItem[]) => left.filter((item) => right.some((other) => other.name === item.name)).length / Math.max(left.length, right.length)
  return routeThemes.flatMap((theme) => {
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
    const first = group[0]
    const last = group.at(-1) ?? first
    const minBudget = group.reduce((total, item) => total + (item.price.unit === 'night' ? 0 : item.price.min), 0)
    const maxBudget = group.reduce((total, item) => total + (item.price.unit === 'night' ? 0 : item.price.max), 0)
    const source = group.find((item) => item.source.kind !== 'amap')?.source ?? first.source
    return {
      id: `knowledge-route-${city}-${index + 1}`,
      cityId: city,
      title: `${city}${theme.label} · ${first.name}`,
      summary: `围绕${first.name}，顺路串起${group.slice(1).map((item) => item.name).join('、') || last.name}，适合${theme.label}。`,
      category: theme.category,
      tags: [...new Set([theme.category, theme.label, '城市精选', ...group.flatMap((item) => item.tags)])].slice(0, 7),
      peopleType: theme.category === '约会' ? ['情侣', '朋友'] : theme.category === '聚餐' ? ['朋友', '同事'] : ['朋友', '独自'],
      weatherType: ['晴天', '阴天'],
      timePeriod: theme.timePeriods,
      duration: durationLabel(group),
      budgetMin: minBudget,
      budgetMax: Math.max(maxBudget, minBudget),
      pois: group.map((item, poiIndex) => ({
        id: `poi-${city}-${index + 1}-${poiIndex + 1}`,
        name: item.name,
        cityId: city,
        latitude: item.coordinates[1],
        longitude: item.coordinates[0],
        address: `${city}${item.area}`,
        category: item.category,
        image: imageForPlace(city, item.name, index + poiIndex),
        coordinateSource: `${item.source.label} · ${item.source.checkedAt}`,
        verified: item.verified,
        stay: `${item.durationMinutes}min`,
        transportation: poiIndex === 0 ? '从这里开始' : '步行路线待服务核验',
        introduction: item.summary,
      })),
      tips: ['地图道路几何由路线服务计算，不用地点之间的直线代替。', '预算按人均区间估算，地点顺序按同一片区组织。'],
      recommendedReason: `围绕${theme.label}安排，优先串联同一片区的地点，减少折返。`,
      cover: imageForPlace(city, first.name, index),
      distanceKm: Math.max(2, Math.round(group.length * 1.4 * 10) / 10),
      sourceName: `${city}城市知识库`,
      sourceUrl: source.url,
    }
  })
}

const knowledgeRoutes: Route[] = Object.entries(cityKnowledge).flatMap(([city, knowledge]) => buildKnowledgeRoutes(city, knowledge.items))

const attachJourneyCover = (route: Route, usedHashes: Set<string>): Route => {
  const selection = selectJourneyCover({
    id: route.id,
    title: route.title,
    category: route.category,
    city: route.cityId,
    places: route.pois.map((poi) => poi.name),
    tags: route.tags,
  }, getCityImageGallery(route.cityId), usedHashes)
  if (!selection.image) return { ...route, cover: undefined, coverImageStatus: selection.status }
  usedHashes.add(selection.image.imageHash)
  return { ...route, cover: selection.image.cachedUrl, coverImage: selection.image, coverImageSource: selection.image.source, coverImageStatus: selection.status }
}

/** Image assignment is prepared at build time from the local, attribution-backed cache. */
const usedCoverHashesByCity = new Map<string, Set<string>>()
export const routes: Route[] = [...officialRoutes, ...knowledgeRoutes].map((route) => {
  const usedHashes = usedCoverHashesByCity.get(route.cityId) ?? new Set<string>()
  const attached = attachJourneyCover(route, usedHashes)
  usedCoverHashesByCity.set(route.cityId, usedHashes)
  return attached
})

const coverMatchesCategory = (category: string, image: string) => {
  if (category !== '聚餐') return true
  return /鸡饭|海鲜|海鲜粉|粉|小吃|餐|夜市|市场|椰子/.test(image)
}

const coverIsSuitableForEntry = (entry: DiscoverItem, route: Route | undefined, cover: string) => {
  if (entry.category !== '聚餐') return true
  if (entry.contentSource === 'user' && cover === entry.cover) return true
  if (route?.cover === cover && route.coverImage?.category === 'dining') return true
  if (route?.pois.some((poi) => poi.image === cover && poi.category === '餐饮')) return true
  return coverMatchesCategory(entry.category, cover)
}

const item = (route: Route, contentSource: ContentSource, suffix: string, score: number): DiscoverItem => {
  const coverIndex = contentSource === 'official' ? 0 : contentSource === 'knowledge' ? 1 : 2
  const categoryCover = route.category === '聚餐' ? route.pois.find((poi) => poi.category === '餐饮')?.image : undefined
  const cover = [route.cover, categoryCover, route.pois[coverIndex % route.pois.length]?.image, route.pois[0].image].find((candidate) => isUserFacingCover(candidate)) ?? ''
  const userCover = contentSource === 'user' ? route.pois.find((poi) => poi.image !== cover && isUserFacingCover(poi.image))?.image ?? cover : cover
  return { id: `post-${route.id}-${suffix}`, contentSource, authorId: contentSource === 'user' ? 'user-xiaopeng' : undefined, authorName: contentSource === 'user' ? '小鹏' : undefined, cityId: route.cityId, title: route.title, subtitle: route.summary, cover: userCover, category: route.category, tags: route.tags, routeId: route.id, duration: route.duration, budget: `¥${route.budgetMin}-${route.budgetMax}/人`, poiCount: route.pois.length, likeCount: 96 + score, saveCount: 38 + score, useCount: 12 + score, publishedAt: '2026-08-28', status: 'published', sourceName: contentSource === 'knowledge' ? route.sourceName ?? `${route.cityId}城市攻略知识库` : undefined, sourceUrl: contentSource === 'knowledge' ? route.sourceUrl : undefined, qualityScore: score, editorScore: score + 2, freshnessScore: 82, routeCompletenessScore: 94 }
}

export const getRoute = (id: string) => routes.find((route) => route.id === id)
export const createUserDiscoverItem = (route: Route, overrides?: Partial<Pick<DiscoverItem, 'title' | 'subtitle' | 'cover' | 'publishedAt'>>): DiscoverItem => ({ ...item(route, 'user', 'shared', 76), ...overrides })
const staticUserItems = [createUserDiscoverItem(routes.find((route) => route.id === officialRoutes[0].id) ?? officialRoutes[0])]
const officialRouteIds = new Set(officialRoutes.map((route) => route.id))
const officialItems = routes.filter((route) => officialRouteIds.has(route.id)).map((route, index) => item(route, 'official', 'official', 90 - index))
const knowledgeItems = routes.filter((route) => !officialRouteIds.has(route.id)).map((route, index) => item(route, 'knowledge', 'knowledge', 88 - (index % 10)))

export const discoverItems: DiscoverItem[] = [...officialItems, ...knowledgeItems, ...staticUserItems]

export const getDiscoverItem = (id: string) => {
  const existing = discoverItems.find((entry) => entry.id === id)
  if (existing) return existing
  const sharedRouteId = id.match(/^post-(.+)-shared$/)?.[1]
  const route = sharedRouteId ? getRoute(sharedRouteId) : undefined
  return route ? createUserDiscoverItem(route) : undefined
}
export const rankScore = (entry: DiscoverItem) => entry.qualityScore * .3 + entry.editorScore * .3 + entry.routeCompletenessScore * .25 + entry.freshnessScore * .15
const overlaps = (a: Route, b: Route) => a.pois.filter((poi) => b.pois.some((other) => other.name === poi.name)).length / Math.max(a.pois.length, b.pois.length)
export const getCityTopGuides = (cityId: string, limit = 15) => {
  const sorted = discoverItems.filter((entry) => entry.cityId === cityId && entry.contentSource === 'knowledge' && entry.status === 'published').sort((a, b) => rankScore(b) - rankScore(a))
  return sorted.reduce<DiscoverItem[]>((kept, candidate) => {
    const route = getRoute(candidate.routeId)
    if (!route || kept.some((entry) => { const keptRoute = getRoute(entry.routeId); return keptRoute && overlaps(route, keptRoute) > .7 })) return kept
    return kept.length < limit ? [...kept, candidate] : kept
  }, [])
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
  const usedCovers = new Set<string>()
  const feed: DiscoverItem[] = []
  for (const entry of [...official, ...knowledge, ...user]) {
    if (feed.length >= config.pageSize) break
    const route = getRoute(entry.routeId)
    const routeImages = route?.pois
      .slice()
      .sort((left, right) => Number(coverMatchesCategory(entry.category, right.image)) - Number(coverMatchesCategory(entry.category, left.image)))
      .map((poi) => poi.image) ?? []
    const galleryImages = getCityImageGallery(cityId)
      .slice()
      .sort((left, right) => Number(coverMatchesCategory(entry.category, right.src)) - Number(coverMatchesCategory(entry.category, left.src)))
      .map((image) => image.src)
    const candidates = [...new Set([
      entry.contentSource === 'user' ? entry.cover : route?.cover,
      ...routeImages,
      entry.cover,
      ...galleryImages,
    ].filter((candidate): candidate is string => isUserFacingCover(candidate)))]
    const cover = candidates.find((candidate) => !usedCovers.has(candidate) && coverIsSuitableForEntry(entry, route, candidate))
    if (!cover) continue
    usedCovers.add(cover)
    feed.push(cover === entry.cover ? entry : { ...entry, cover })
  }
  return feed
}

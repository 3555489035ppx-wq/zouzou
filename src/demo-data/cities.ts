import { tripDays, type Place } from './trips'
import { getCityKnowledge, type KnowledgeCategory } from '../services/trip/cityKnowledge'
import { regionalCityProfiles } from './regional-city-profiles'

export type CityProfile = {
  mapCenter: [number, number]
  weather: { latitude: number; longitude: number }
  demoLabels: string[]
  /** Role-specific landmarks used to keep the generated route coherent. */
  stopNames?: Record<string, string>
  routeScale: number
}

// Map coordinates are used by AMap overlays. Weather coordinates are kept as
// WGS84 values for the weather provider instead of mixing the two systems.
export const cityProfiles: Record<string, CityProfile> = {
  上海: {
    mapCenter: [121.4737, 31.2304],
    weather: { latitude: 31.2304, longitude: 121.4737 },
    demoLabels: ['武康路', '安福路', '野馆咖啡', '浦东美术馆', '福和慧'],
    routeScale: 1,
  },
  杭州: {
    mapCenter: [120.1551, 30.2741],
    weather: { latitude: 30.2741, longitude: 120.1551 },
    demoLabels: ['西湖边', '天目里', '手冲咖啡馆', '中国美术学院', '湖滨晚餐'],
    routeScale: 0.58,
  },
  苏州: {
    mapCenter: [120.5853, 31.2989],
    weather: { latitude: 31.2989, longitude: 120.5853 },
    demoLabels: ['平江路', '苏州博物馆', '园林咖啡', '拙政园', '山塘街晚餐'],
    routeScale: 0.58,
  },
  南京: {
    mapCenter: [118.7969, 32.0603],
    weather: { latitude: 32.0603, longitude: 118.7969 },
    demoLabels: ['颐和路', '先锋书店', '秦淮咖啡', '南京博物院', '老门东晚餐'],
    routeScale: 0.58,
  },
  成都: {
    mapCenter: [104.0668, 30.5728],
    weather: { latitude: 30.5728, longitude: 104.0668 },
    demoLabels: ['宽窄巷子', '人民公园', '玉林咖啡', '成都美术馆', '九眼桥晚餐'],
    routeScale: 0.58,
  },
  厦门: {
    mapCenter: [118.0894, 24.4798],
    weather: { latitude: 24.4798, longitude: 118.0894 },
    demoLabels: ['沙坡尾', '鼓浪屿码头', '海边咖啡', '厦门美术馆', '曾厝垵晚餐'],
    routeScale: 0.58,
  },
  北京: {
    mapCenter: [116.4074, 39.9042],
    weather: { latitude: 39.9042, longitude: 116.4074 },
    demoLabels: ['胡同散步', '798 艺术区', '豆汁咖啡', '中国美术馆', '三里屯晚餐'],
    routeScale: 0.58,
  },
  广州: {
    mapCenter: [113.2644, 23.1291],
    weather: { latitude: 23.1291, longitude: 113.2644 },
    demoLabels: ['永庆坊', '沙面', '骑楼咖啡', '广东美术馆', '珠江晚餐'],
    routeScale: 0.58,
  },
  重庆: {
    mapCenter: [106.5516, 29.5630],
    weather: { latitude: 29.5630, longitude: 106.5516 },
    demoLabels: ['洪崖洞', '解放碑', '山城步道', '重庆美术馆', '南滨路晚餐'],
    routeScale: 0.58,
  },
  西安: {
    mapCenter: [108.9398, 34.3416],
    weather: { latitude: 34.3416, longitude: 108.9398 },
    demoLabels: ['钟楼', '回民街', '城墙咖啡', '陕西历史博物馆', '永兴坊晚餐'],
    routeScale: 0.58,
  },
  深圳: {
    mapCenter: [114.0579, 22.5431],
    weather: { latitude: 22.5431, longitude: 114.0579 },
    demoLabels: ['南头古城', '华侨城', '人才公园', '深圳博物馆', '海上世界晚餐'],
    routeScale: 0.58,
  },
  长沙: {
    mapCenter: [112.9388, 28.2282],
    weather: { latitude: 28.2282, longitude: 112.9388 },
    demoLabels: ['岳麓山', '橘子洲', '太平街咖啡', '湖南博物院', '湘江夜景晚餐'],
    routeScale: 0.58,
  },
  青岛: {
    mapCenter: [120.3826, 36.0671],
    weather: { latitude: 36.0671, longitude: 120.3826 },
    demoLabels: ['栈桥', '八大关', '大学路咖啡', '青岛啤酒博物馆', '小麦岛'],
    stopNames: {
      'wukang-road': '栈桥—浙江路老城区',
      'anfu-road': '八大关',
      'wukang-cafe': '大学路咖啡',
      'shanghai-museum-east': '青岛啤酒博物馆',
      'lujiazui-lunch': '老城区本地午餐',
      'pudong-riverside': '小麦岛海边散步',
      bund: '五四广场海边',
      'bund-dinner': '台东晚餐',
      yuyuan: '小青岛公园',
      'oldtown-lunch': '市南区午餐',
      'sinan-bookstore': '信号山公园',
      'suzhou-creek-night': '情人坝夜景',
    },
    routeScale: 0.58,
  },
  武汉: {
    mapCenter: [114.3055, 30.5928],
    weather: { latitude: 30.5928, longitude: 114.3055 },
    demoLabels: ['东湖凌波门', '昙华林', '粮道街咖啡', '湖北省博物馆', '江汉路'],
    stopNames: {
      'wukang-road': '东湖凌波门',
      'anfu-road': '昙华林历史街区',
      'wukang-cafe': '粮道街咖啡',
      'shanghai-museum-east': '湖北省博物馆',
      'lujiazui-lunch': '武昌本地午餐',
      'pudong-riverside': '东湖绿道',
      bund: '长江大桥江滩',
      'bund-dinner': '江汉路晚餐',
      yuyuan: '黄鹤楼',
      'oldtown-lunch': '户部巷午餐',
      'sinan-bookstore': '武汉美术馆',
      'suzhou-creek-night': '汉口江滩夜景',
    },
    routeScale: 0.58,
  },
  昆明: {
    mapCenter: [102.8329, 24.8801],
    weather: { latitude: 24.8801, longitude: 102.8329 },
    demoLabels: ['翠湖公园', '文林街', '昆明老街咖啡', '云南省博物馆', '滇池海埂公园'],
    stopNames: {
      'wukang-road': '翠湖公园',
      'anfu-road': '文林街—文化巷',
      'wukang-cafe': '昆明老街咖啡',
      'shanghai-museum-east': '云南省博物馆',
      'lujiazui-lunch': '南屏街本地午餐',
      'pudong-riverside': '滇池海埂公园',
      bund: '海埂大坝日落',
      'bund-dinner': '昆明老街晚餐',
      yuyuan: '斗南花市',
      'oldtown-lunch': '官渡古镇午餐',
      'sinan-bookstore': '云南美术馆',
      'suzhou-creek-night': '金马碧鸡坊夜景',
    },
    routeScale: 0.58,
  },
  三亚: {
    mapCenter: [109.5119, 18.2528],
    weather: { latitude: 18.2528, longitude: 109.5119 },
    demoLabels: ['椰梦长廊', '鹿回头', '海边咖啡', '三亚市博物馆', '亚龙湾'],
    stopNames: {
      'wukang-road': '椰梦长廊',
      'anfu-road': '鹿回头风景区',
      'wukang-cafe': '大东海海边咖啡',
      'shanghai-museum-east': '三亚市博物馆',
      'lujiazui-lunch': '大东海本地午餐',
      'pudong-riverside': '亚龙湾海滩',
      bund: '太阳湾观景台',
      'bund-dinner': '大东海晚餐',
      yuyuan: '天涯海角',
      'oldtown-lunch': '三亚湾午餐',
      'sinan-bookstore': '三亚湾海边散步',
      'suzhou-creek-night': '三亚湾夜景',
    },
    routeScale: 0.58,
  },
  桂林: {
    mapCenter: [110.2991, 25.2742],
    weather: { latitude: 25.2742, longitude: 110.2991 },
    demoLabels: ['象鼻山', '东西巷', '阳朔咖啡', '桂林博物馆', '两江四湖'],
    stopNames: {
      'wukang-road': '象鼻山公园',
      'anfu-road': '东西巷历史街区',
      'wukang-cafe': '阳朔西街咖啡',
      'shanghai-museum-east': '桂林博物馆',
      'lujiazui-lunch': '正阳步行街午餐',
      'pudong-riverside': '漓江边散步',
      bund: '两江四湖日落',
      'bund-dinner': '桂林米粉晚餐',
      yuyuan: '阳朔遇龙河',
      'oldtown-lunch': '阳朔本地午餐',
      'sinan-bookstore': '阳朔西街',
      'suzhou-creek-night': '日月双塔夜景',
    },
    routeScale: 0.58,
  },
  哈尔滨: {
    mapCenter: [126.6424, 45.7560],
    weather: { latitude: 45.7560, longitude: 126.6424 },
    demoLabels: ['中央大街', '圣索菲亚教堂', '老道外咖啡', '黑龙江省博物馆', '松花江'],
    stopNames: {
      'wukang-road': '中央大街',
      'anfu-road': '老道外中华巴洛克',
      'wukang-cafe': '中央大街咖啡',
      'shanghai-museum-east': '黑龙江省博物馆',
      'lujiazui-lunch': '道里区本地午餐',
      'pudong-riverside': '松花江畔散步',
      bund: '斯大林公园',
      'bund-dinner': '中央大街晚餐',
      yuyuan: '圣索菲亚教堂',
      'oldtown-lunch': '红专街早市午餐',
      'sinan-bookstore': '哈尔滨建筑艺术馆',
      'suzhou-creek-night': '冰雪大世界夜景',
    },
    routeScale: 0.58,
  },
  贵阳: {
    mapCenter: [106.6302, 26.6477],
    weather: { latitude: 26.6477, longitude: 106.6302 },
    demoLabels: ['青云市集', '黔灵山公园', '花溪咖啡', '贵州省博物馆', '甲秀楼'],
    stopNames: {
      'wukang-road': '青云市集',
      'anfu-road': '黔灵山公园',
      'wukang-cafe': '花溪咖啡',
      'shanghai-museum-east': '贵州省博物馆',
      'lujiazui-lunch': '南明区本地午餐',
      'pudong-riverside': '花溪公园',
      bund: '甲秀楼',
      'bund-dinner': '青云市集晚餐',
      yuyuan: '青岩古镇',
      'oldtown-lunch': '青岩古镇午餐',
      'sinan-bookstore': '贵州美术馆',
      'suzhou-creek-night': '甲秀楼夜景',
    },
    routeScale: 0.58,
  },
  张家界: {
    mapCenter: [110.4790, 29.1170],
    weather: { latitude: 29.1170, longitude: 110.4790 },
    demoLabels: ['天门山', '大庸古城', '景区咖啡', '张家界市博物馆', '武陵源'],
    stopNames: {
      'wukang-road': '天门山国家森林公园',
      'anfu-road': '大庸古城',
      'wukang-cafe': '市区景区咖啡',
      'shanghai-museum-east': '张家界市博物馆',
      'lujiazui-lunch': '市区本地午餐',
      'pudong-riverside': '武陵源溪布街',
      bund: '武陵源景区入口',
      'bund-dinner': '武陵源晚餐',
      yuyuan: '宝峰湖',
      'oldtown-lunch': '武陵源午餐',
      'sinan-bookstore': '十里画廊',
      'suzhou-creek-night': '溪布街夜景',
    },
    routeScale: 0.58,
  },
  ...regionalCityProfiles,
}

export const cityNames = Object.keys(cityProfiles)

const sourceCenter = cityProfiles['上海'].mapCenter

export function getCityProfile(city: string): CityProfile {
  return cityProfiles[city] ?? cityProfiles['上海']
}

/**
 * Builds a believable local demo route around the selected city. The route
 * remains intentionally static: it is for the portfolio interaction, not a
 * claim that these are walking-navigation results.
 */
export function getDemoTripPlaces(city: string, day: string): Place[] {
  const profile = getCityProfile(city)
  const sourcePlaces = tripDays[day] ?? tripDays['Day 1']

  if (city !== '上海') {
    const knowledgeItems = getCityKnowledge(city).items.filter((item) => item.coordinates.some((value) => value !== 0))
    const used = new Set<string>()
    const categoryFor = (type: string): KnowledgeCategory[] => /咖啡|早餐|午餐|晚餐|美食|小吃/.test(type)
      ? ['restaurant', 'food']
      : /展|博物馆|景点|园林|山|湖|公园/.test(type)
        ? ['attraction', 'activity']
        : ['activity', 'attraction']
    const sourcedPlaces = sourcePlaces.map<Place | null>((place, index) => {
      const categories = categoryFor(place.type)
      const item = knowledgeItems.find((candidate) => !used.has(candidate.id) && categories.includes(candidate.category)) ?? knowledgeItems.find((candidate) => !used.has(candidate.id))
      if (!item) return null
      used.add(item.id)
      return {
        ...place,
        id: `${city}-${day}-${place.id}`,
        name: item.name,
        type: item.category === 'restaurant' ? '晚餐候选' : item.category === 'food' ? '本地美食候选' : place.type,
        note: `${item.summary} 来源：${item.source.label}。`,
        lng: item.coordinates[0],
        lat: item.coordinates[1],
        coordinateSource: `高德 POI：${item.name} · ${item.source.checkedAt}`,
        verified: item.verified,
        x: index,
        z: index,
      } satisfies Place
    }).filter((place): place is Place => Boolean(place))
    if (sourcedPlaces.length === sourcePlaces.length) return sourcedPlaces
  }

  return sourcePlaces.map((place, index) => ({
    ...place,
    id: `${city}-${day}-${place.id}`,
    name: city === '上海' ? place.name : profile.demoLabels[index] ?? `${city} · 演示地点 ${index + 1}`,
    lng: profile.mapCenter[0] + (place.lng - sourceCenter[0]) * profile.routeScale,
    lat: profile.mapCenter[1] + (place.lat - sourceCenter[1]) * profile.routeScale,
    coordinateSource: city === '上海' ? '行程种子坐标；路线由服务实时计算' : '城市候选骨架；坐标待 POI 核验',
    verified: city === '上海',
  }))
}

export function getDemoHotel(city: string): Place {
  const profile = getCityProfile(city)
  return {
    id: `${city}-hotel-start`,
    time: '08:50',
    name: city === '上海' ? '静安酒店' : `${city}中心酒店`,
    type: '酒店',
    stay: '出发',
    // Allocate the two-night reference price to the first hotel stop so the
    // itinerary never presents an implausible ¥0 lodging line item.
    budget: city === '上海' ? 980 : 760,
    transport: '步行 18 分钟',
    note: '两晚住宿参考价已计入，实际以酒店当天公开信息为准。',
    x: -3.4,
    z: 2.1,
    lng: profile.mapCenter[0],
    lat: profile.mapCenter[1],
    coordinateSource: city === '上海' ? '行程种子坐标；路线由服务实时计算' : '城市候选酒店位置；坐标待 POI 核验',
    verified: city === '上海',
  }
}

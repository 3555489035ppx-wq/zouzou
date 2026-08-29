import { tripDays, type Place } from './trips'

export type CityProfile = {
  mapCenter: [number, number]
  weather: { latitude: number; longitude: number }
  demoLabels: string[]
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

  return sourcePlaces.map((place, index) => ({
    ...place,
    id: `${city}-${day}-${place.id}`,
    name: city === '上海' ? place.name : profile.demoLabels[index] ?? `${city} · 演示地点 ${index + 1}`,
    lng: profile.mapCenter[0] + (place.lng - sourceCenter[0]) * profile.routeScale,
    lat: profile.mapCenter[1] + (place.lat - sourceCenter[1]) * profile.routeScale,
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
    note: '两晚住宿参考价已计入，实际以预订平台为准。',
    x: -3.4,
    z: 2.1,
    lng: profile.mapCenter[0],
    lat: profile.mapCenter[1],
  }
}

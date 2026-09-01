export type Place = {
  id: string
  time: string
  name: string
  type: string
  stay: string
  budget: number
  transport: string
  note: string
  x: number
  z: number
  lng: number
  lat: number
  area?: string
  inputName?: string
  canonicalName?: string
  address?: string
  poiId?: string
  amapPoiId?: string
  district?: string
  adcode?: string
  citycode?: string
  poiType?: string
  tel?: string
  verifiedAt?: number
  resolutionStatus?: 'verified' | 'ambiguous' | 'not_found' | 'error'
  coordinateSystem?: 'wgs84' | 'gcj02'
  mapStatus?: 'resolved' | 'unresolved'
  searchKeyword?: string
  coordinateSource?: string
  verified?: boolean
}

export type Plan = {
  id: string
  label: string
  budget: number
  places: number
  walking: string
  pace: string
  difference: string
}

export const plans: Plan[] = [
  { id: 'match', label: '最匹配', budget: 1860, places: 8, walking: '6.8 km', pace: '松弛', difference: '把必去地点和雨天下午的展览安排得最稳妥。' },
  { id: 'easy', label: '最轻松', budget: 1640, places: 6, walking: '4.2 km', pace: '很轻松', difference: '减少跨区移动，每天留出两段自由时间。' },
  { id: 'rich', label: '体验最丰富', budget: 2280, places: 10, walking: '9.4 km', pace: '充实', difference: '加入夜景和两处小众空间，步行更多。' },
]

export const tripDays: Record<string, Place[]> = {
  'Day 1': [
    { id: 'wukang', time: '09:30', name: '武康路', type: 'City Walk', stay: '1h 35min', budget: 68, transport: '步行 8 分钟', note: '上午光线柔和，适合慢慢走。', x: -2.8, z: 1.8, lng: 121.4374, lat: 31.2111 },
    { id: 'anfuroad', time: '11:20', name: '安福路', type: '街区', stay: '55min', budget: 0, transport: '步行 6 分钟', note: '保留一段自由逛店时间。', x: -1.2, z: 0.9, lng: 121.4435, lat: 31.2161 },
    { id: 'coffee', time: '12:30', name: '野馆咖啡', type: '咖啡', stay: '1h', budget: 56, transport: '地铁 24 分钟', note: '位于路线中段，适合作为休息点。', x: 0.2, z: 0.1, lng: 121.4542, lat: 31.2195 },
    { id: 'museum', time: '14:20', name: '浦东美术馆', type: '展览', stay: '2h', budget: 180, transport: '步行 12 分钟', note: '下午可能有雨，已放到降雨时段。', x: 1.6, z: -0.8, lng: 121.5076, lat: 31.2417 },
    { id: 'dinner', time: '18:10', name: '福和慧', type: '晚餐', stay: '1h 40min', budget: 420, transport: '打车 18 分钟', note: '餐厅已预留足够用餐时间。', x: 3.0, z: -1.6, lng: 121.4547, lat: 31.2267 },
  ],
  'Day 2': [
    { id: 'bund', time: '09:10', name: '外滩', type: '散步', stay: '1h 20min', budget: 0, transport: '轮渡 15 分钟', note: '早上人少，风也更轻。', x: -2.6, z: 1.4, lng: 121.4902, lat: 31.2393 },
    { id: 'northbund', time: '11:10', name: '北外滩', type: '建筑', stay: '1h', budget: 0, transport: '地铁 28 分钟', note: '顺着江边继续，不折返。', x: -0.7, z: 0.2, lng: 121.4995, lat: 31.2537 },
    { id: 'm50', time: '14:00', name: 'M50 创意园', type: '展览', stay: '2h', budget: 80, transport: '步行 10 分钟', note: '室内为主，雨天也可执行。', x: 1.1, z: -0.8, lng: 121.4479, lat: 31.2525 },
    { id: 'bar', time: '19:30', name: '苏河夜色', type: '夜景', stay: '1h 30min', budget: 120, transport: '步行 14 分钟', note: '不赶下一站，慢慢结束一天。', x: 2.8, z: -1.5, lng: 121.462, lat: 31.246 },
  ],
  'Day 3': [
    { id: 'yuyuan', time: '09:30', name: '豫园', type: '园林', stay: '1h 40min', budget: 40, transport: '地铁 18 分钟', note: '提前到达避开午间人流。', x: -2.4, z: 1.4, lng: 121.492, lat: 31.227 },
    { id: 'bookstore', time: '12:10', name: '思南书局', type: '书店', stay: '1h', budget: 40, transport: '步行 8 分钟', note: '离返程路线近，适合收尾。', x: 0, z: 0, lng: 121.466, lat: 31.212 },
    { id: 'hotel', time: '15:30', name: '静安酒店', type: '酒店', stay: '取行李', budget: 0, transport: '前往车站 35 分钟', note: '住宿已锁定。', x: 2.5, z: -1.3, lng: 121.445, lat: 31.223 },
  ],
}

export const friends = [
  { id: 'xiaopeng', name: '小鹏', image: '/assets/date.jpg', status: 'accepted' },
  { id: 'lin', name: '林晓', image: '/assets/coffee.jpg', status: 'accepted' },
  { id: 'zhou', name: '周周', image: '/assets/weekend.jpg', status: 'accepted' },
  { id: 'anne', name: '安安', image: '/assets/gallery.jpg', status: 'pending' },
]

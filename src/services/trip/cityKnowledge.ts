export type KnowledgeCategory = 'attraction' | 'food' | 'restaurant' | 'activity'

export type KnowledgeSourceKind = 'official' | 'amap' | 'community'

export type KnowledgeSource = {
  label: string
  url: string
  kind: KnowledgeSourceKind
  checkedAt: string
}

export type KnowledgePrice = {
  min: number
  max: number
  unit: 'person' | 'night' | 'ticket'
  note?: string
}

export type CityKnowledgeItem = {
  id: string
  name: string
  category: KnowledgeCategory
  area: string
  tags: string[]
  summary: string
  coordinates: [number, number]
  durationMinutes: number
  price: KnowledgePrice
  opening?: {
    from: string
    to: string
    label: string
    closedWeekdays?: number[]
  }
  source: KnowledgeSource
  verified: boolean
}

export type HotelOption = {
  id: string
  name: string
  area: string
  tier: 'budget' | 'comfort' | 'premium'
  nightly: { min: number; max: number }
  summary: string
  source: KnowledgeSource
  verified: boolean
}

export type CityKnowledge = {
  city: string
  status: 'curated' | 'fallback'
  updatedAt: string
  intro: string
  items: CityKnowledgeItem[]
  hotelOptions: HotelOption[]
  sources: KnowledgeSource[]
}

const UPDATED_AT = '2026-08-30'
const amapSource = (label: string, query: string): KnowledgeSource => ({
  label,
  url: `https://ditu.amap.com/search?query=${encodeURIComponent(query)}`,
  kind: 'amap',
  checkedAt: UPDATED_AT,
})

const hunanGovSource: KnowledgeSource = {
  label: '湖南省人民政府：岳麓山橘子洲预约提示',
  url: 'https://enghunan.gov.cn/hneng/SP/sp2023/2023MayDay/202304/t20230426_29324698.html',
  kind: 'official',
  checkedAt: UPDATED_AT,
}

const hunanMuseumSource: KnowledgeSource = {
  label: '湖南博物院：参观指南',
  url: 'https://web.hnmuseum.com/en/content/changsha-mawangdui-han-dynasty-tombs-exhibition',
  kind: 'official',
  checkedAt: UPDATED_AT,
}

const changshaHotelSource = amapSource('高德 POI：长沙住宿区域查询', '长沙 五一广场 酒店')

const changshaKnowledge: CityKnowledge = {
  city: '长沙',
  status: 'curated',
  updatedAt: UPDATED_AT,
  intro: '以五一广场为交通基点，把岳麓山—橘子洲—老城逛吃串成不绕路的三日骨架。价格是预算估算，实时 POI、预约和库存仍需出行前核验。',
  sources: [hunanGovSource, hunanMuseumSource, changshaHotelSource],
  hotelOptions: [
    {
      id: 'changsha-budget-hotel',
      name: '五一广场地铁站附近经济型酒店',
      area: '芙蓉区 / 五一广场',
      tier: 'budget',
      nightly: { min: 220, max: 320 },
      summary: '离地铁和老城较近，优先满足低预算与少换乘。',
      source: changshaHotelSource,
      verified: false,
    },
    {
      id: 'changsha-comfort-hotel',
      name: 'IFS / 五一广场附近舒适型酒店',
      area: '芙蓉区 / 解放西',
      tier: 'comfort',
      nightly: { min: 380, max: 580 },
      summary: '房间舒适度与位置更均衡，适合两人 3 天 2 晚。',
      source: changshaHotelSource,
      verified: false,
    },
    {
      id: 'changsha-premium-hotel',
      name: '湘江 / IFS 附近高星酒店',
      area: '芙蓉区 / 湘江沿线',
      tier: 'premium',
      nightly: { min: 700, max: 1100 },
      summary: '把更多预算留给景观、服务与酒店本身。',
      source: changshaHotelSource,
      verified: false,
    },
  ],
  items: [
    {
      id: 'changsha-yuelu',
      name: '岳麓山风景名胜区',
      category: 'attraction',
      area: '岳麓区',
      tags: ['自然', '城市漫步', '免费', '上午'],
      summary: '上午进山，保留登高和沿山步行的弹性，不把景区压成打卡点。',
      coordinates: [112.9347, 28.1844],
      durationMinutes: 180,
      price: { min: 0, max: 0, unit: 'ticket', note: '核心景区预约与交通接驳以当日公告为准' },
      source: hunanGovSource,
      verified: true,
    },
    {
      id: 'changsha-orange-isle',
      name: '橘子洲景区',
      category: 'attraction',
      area: '湘江中心',
      tags: ['滨江', '城市漫步', '免费', '日落'],
      summary: '沿江慢走，和岳麓山分开安排，避免同一时段跨江折返。',
      coordinates: [112.9601, 28.1655],
      durationMinutes: 150,
      price: { min: 0, max: 0, unit: 'ticket', note: '景区预约、接驳车和客流限制以当日公告为准' },
      source: hunanGovSource,
      verified: true,
    },
    {
      id: 'changsha-museum',
      name: '湖南博物院',
      category: 'attraction',
      area: '开福区',
      tags: ['展览', '室内', '预约', '雨天备选'],
      summary: '马王堆汉墓展是长沙的高价值室内主线，建议提前预约。',
      coordinates: [112.9843, 28.2204],
      durationMinutes: 150,
      price: { min: 0, max: 0, unit: 'ticket', note: '基本陈列免费；需携有效证件并按官方规则预约' },
      opening: { from: '09:00', to: '17:00', label: '周二至周日 9:00–17:00，16:00停止入馆', closedWeekdays: [1] },
      source: hunanMuseumSource,
      verified: true,
    },
    {
      id: 'changsha-taiping',
      name: '太平街历史文化街区',
      category: 'activity',
      area: '天心区',
      tags: ['老街', '城市漫步', '小吃', '傍晚'],
      summary: '把太平街、坡子街和五一广场放在同一片区，留出边走边吃的时间。',
      coordinates: [112.9738, 28.1933],
      durationMinutes: 100,
      price: { min: 0, max: 30, unit: 'person', note: '街区免费，消费取决于餐饮与小店' },
      source: amapSource('高德 POI：太平街历史文化街区', '长沙 太平街历史文化街区'),
      verified: false,
    },
    {
      id: 'changsha-dufu',
      name: '杜甫江阁',
      category: 'activity',
      area: '湘江东岸',
      tags: ['夜景', '湘江', '日落'],
      summary: '把夜景作为收尾，不和橘子洲安排成两次来回过江。',
      coordinates: [112.9677, 28.1837],
      durationMinutes: 70,
      price: { min: 0, max: 20, unit: 'ticket', note: '登阁票价和灯光时段需按当日公告复核' },
      source: amapSource('高德 POI：杜甫江阁', '长沙 杜甫江阁'),
      verified: false,
    },
    {
      id: 'changsha-wuyi',
      name: '五一广场—黄兴路步行街',
      category: 'activity',
      area: '芙蓉区',
      tags: ['夜生活', '城市', '逛吃'],
      summary: '适合把晚餐、茶饮和返酒店安排在同一片区，减少夜间交通。',
      coordinates: [112.9763, 28.1946],
      durationMinutes: 90,
      price: { min: 0, max: 30, unit: 'person', note: '街区免费，消费取决于餐饮与小店' },
      source: amapSource('高德 POI：黄兴路步行街', '长沙 黄兴路步行街'),
      verified: false,
    },
    {
      id: 'changsha-stinky-tofu',
      name: '长沙臭豆腐',
      category: 'food',
      area: '太平街 / 坡子街',
      tags: ['本地小吃', '低预算', '随走随吃'],
      summary: '作为街区小吃而不是固定正餐，给午后或晚餐前留 20–30 分钟。',
      coordinates: [112.9743, 28.1938],
      durationMinutes: 30,
      price: { min: 8, max: 20, unit: 'person', note: '摊位与门店价格浮动，按现场菜单为准' },
      source: amapSource('高德 POI：长沙臭豆腐', '长沙 太平街 臭豆腐'),
      verified: false,
    },
    {
      id: 'changsha-tangyou',
      name: '糖油粑粑',
      category: 'food',
      area: '老城街区',
      tags: ['本地小吃', '低预算', '早餐'],
      summary: '早餐或下午茶更合适，不与正餐争时间。',
      coordinates: [112.9784, 28.1942],
      durationMinutes: 25,
      price: { min: 8, max: 18, unit: 'person', note: '按现场菜单为准' },
      source: amapSource('高德 POI：长沙糖油粑粑', '长沙 糖油粑粑'),
      verified: false,
    },
    {
      id: 'changsha-kouwei',
      name: '口味虾 / 湘菜晚餐',
      category: 'restaurant',
      area: '五一广场 / 坡子街',
      tags: ['湘菜', '晚餐', '多人'],
      summary: '把辣度、忌口和排队情况放在到店前确认，按两人预算保留 1 小时 30 分钟。',
      coordinates: [112.9789, 28.1941],
      durationMinutes: 90,
      price: { min: 70, max: 140, unit: 'person', note: '人均为规划估算，不是实时菜单价格' },
      source: amapSource('高德 POI：长沙湘菜餐厅', '长沙 五一广场 湘菜 餐厅'),
      verified: false,
    },
    {
      id: 'changsha-feidachu',
      name: '辣椒炒肉（本地湘菜馆）',
      category: 'restaurant',
      area: '五一广场片区',
      tags: ['湘菜', '午餐', '性价比'],
      summary: '午餐优先选片区内门店，避免为一顿饭跨区。',
      coordinates: [112.9771, 28.1952],
      durationMinutes: 70,
      price: { min: 45, max: 90, unit: 'person', note: '人均为规划估算，门店与套餐需实时核验' },
      source: amapSource('高德 POI：长沙辣椒炒肉', '长沙 五一广场 辣椒炒肉'),
      verified: false,
    },
    {
      id: 'changsha-tea',
      name: '茶颜悦色（茶饮休息）',
      category: 'food',
      area: '五一广场片区',
      tags: ['茶饮', '休息', '低预算'],
      summary: '只作为移动缓冲和休息，不把排队时长写成硬承诺。',
      coordinates: [112.9778, 28.1948],
      durationMinutes: 35,
      price: { min: 15, max: 28, unit: 'person', note: '门店与时段会影响排队和价格' },
      source: amapSource('高德 POI：茶颜悦色', '长沙 五一广场 茶颜悦色'),
      verified: false,
    },
  ],
}

const shanghaiKnowledge: CityKnowledge = {
  city: '上海',
  status: 'curated',
  updatedAt: UPDATED_AT,
  intro: '保留武康路、安福路、外滩等街区主线，并把展览、咖啡和本地餐饮作为可替换节点。',
  sources: [amapSource('高德 POI：上海旅行候选查询', '上海 武康路 安福路 外滩')],
  hotelOptions: [
    { id: 'shanghai-budget-hotel', name: '静安寺地铁站附近经济型酒店', area: '静安', tier: 'budget', nightly: { min: 320, max: 480 }, summary: '优先控制住宿成本，通勤仍方便。', source: amapSource('高德 POI：上海住宿区域查询', '上海 静安寺 酒店'), verified: false },
    { id: 'shanghai-comfort-hotel', name: '静安寺 / 淮海中路附近舒适型酒店', area: '静安 / 黄浦', tier: 'comfort', nightly: { min: 520, max: 780 }, summary: '位置和舒适度均衡。', source: amapSource('高德 POI：上海住宿区域查询', '上海 静安寺 淮海中路 酒店'), verified: false },
    { id: 'shanghai-premium-hotel', name: '外滩 / 陆家嘴景观酒店', area: '黄浦 / 浦东', tier: 'premium', nightly: { min: 900, max: 1600 }, summary: '将更多预算用于景观与服务。', source: amapSource('高德 POI：上海住宿区域查询', '上海 外滩 陆家嘴 酒店'), verified: false },
  ],
  items: [
    { id: 'shanghai-wukang', name: '武康路', category: 'attraction', area: '徐汇', tags: ['城市漫步', '街区', '上午'], summary: '保留街区漫步时间，不把整条路压成打卡点。', coordinates: [121.4374, 31.2111], durationMinutes: 90, price: { min: 0, max: 20, unit: 'person', note: '街区免费，消费取决于店铺' }, source: amapSource('高德 POI：武康路', '上海 武康路'), verified: false },
    { id: 'shanghai-anfu', name: '安福路', category: 'activity', area: '徐汇', tags: ['城市漫步', '街区', '逛店'], summary: '和武康路放在同一片区，减少折返。', coordinates: [121.4435, 31.2161], durationMinutes: 60, price: { min: 0, max: 30, unit: 'person', note: '街区免费' }, source: amapSource('高德 POI：安福路', '上海 安福路'), verified: false },
    { id: 'shanghai-museum', name: '浦东美术馆', category: 'attraction', area: '浦东', tags: ['展览', '室内', '雨天备选'], summary: '用一段室内展览平衡街区漫步。', coordinates: [121.5076, 31.2417], durationMinutes: 120, price: { min: 80, max: 120, unit: 'ticket', note: '展览票价按当期公告复核' }, source: amapSource('高德 POI：浦东美术馆', '上海 浦东美术馆'), verified: false },
    { id: 'shanghai-bund', name: '外滩', category: 'attraction', area: '黄浦', tags: ['滨江', '夜景', '城市'], summary: '下午到傍晚连续停留，不安排两岸往返。', coordinates: [121.4902, 31.2393], durationMinutes: 100, price: { min: 0, max: 0, unit: 'ticket' }, source: amapSource('高德 POI：外滩', '上海 外滩'), verified: false },
    { id: 'shanghai-food', name: '本帮菜午餐', category: 'restaurant', area: '静安 / 黄浦', tags: ['本地美食', '午餐'], summary: '按人均预算选择本帮菜门店，先看实时排队。', coordinates: [121.458, 31.228], durationMinutes: 70, price: { min: 60, max: 120, unit: 'person', note: '人均为规划估算' }, source: amapSource('高德 POI：上海本帮菜', '上海 本帮菜 餐厅'), verified: false },
    { id: 'shanghai-coffee', name: '武康路咖啡休息', category: 'food', area: '徐汇', tags: ['咖啡', '休息'], summary: '把咖啡店作为缓冲，不把它当成必须打卡的硬任务。', coordinates: [121.4385, 31.2145], durationMinutes: 60, price: { min: 35, max: 80, unit: 'person', note: '门店价格按现场菜单为准' }, source: amapSource('高德 POI：武康路咖啡', '上海 武康路 咖啡'), verified: false },
  ],
}

function fallbackKnowledge(city: string): CityKnowledge {
  const center: [number, number] = [0, 0]
  return {
    city,
    status: 'fallback',
    updatedAt: UPDATED_AT,
    intro: `${city}暂时没有足够的事实级城市条目；先按城市候选生成完整结构，价格、营业时间和路线必须在出行前用实时 POI 复核。`,
    sources: [amapSource(`高德 POI：${city}候选查询`, `${city} 景点 餐厅 酒店`)],
    hotelOptions: [
      { id: `${city}-budget-hotel`, name: `${city}市中心经济型酒店（待选）`, area: '市中心', tier: 'budget', nightly: { min: 180, max: 300 }, summary: '低预算占位候选，需实时查询门店。', source: amapSource(`高德 POI：${city}住宿查询`, `${city} 市中心 酒店`), verified: false },
      { id: `${city}-comfort-hotel`, name: `${city}市中心舒适型酒店（待选）`, area: '市中心', tier: 'comfort', nightly: { min: 360, max: 600 }, summary: '中等预算占位候选，需实时查询门店。', source: amapSource(`高德 POI：${city}住宿查询`, `${city} 市中心 酒店`), verified: false },
      { id: `${city}-premium-hotel`, name: `${city}核心区高星酒店（待选）`, area: '核心区', tier: 'premium', nightly: { min: 700, max: 1200 }, summary: '高预算占位候选，需实时查询门店。', source: amapSource(`高德 POI：${city}住宿查询`, `${city} 核心区 酒店`), verified: false },
    ],
    items: [
      { id: `${city}-landmark`, name: `${city}城市地标（待核验）`, category: 'attraction', area: '市中心', tags: ['城市', '首访'], summary: '来自城市候选标签，正式行程前需要 POI 消歧。', coordinates: center, durationMinutes: 120, price: { min: 0, max: 80, unit: 'ticket', note: '价格待实时核验' }, source: amapSource(`高德 POI：${city}城市地标`, `${city} 城市地标`), verified: false },
      { id: `${city}-walk`, name: `${city}历史街区（待核验）`, category: 'activity', area: '老城', tags: ['城市漫步', '街区'], summary: '作为慢走与逛店候选，路线待实时核验。', coordinates: center, durationMinutes: 100, price: { min: 0, max: 30, unit: 'person' }, source: amapSource(`高德 POI：${city}历史街区`, `${city} 历史街区`), verified: false },
      { id: `${city}-museum`, name: `${city}博物馆（待核验）`, category: 'attraction', area: '市中心', tags: ['展览', '室内'], summary: '作为雨天备选，开放时间和预约待核验。', coordinates: center, durationMinutes: 120, price: { min: 0, max: 80, unit: 'ticket', note: '价格与预约待实时核验' }, source: amapSource(`高德 POI：${city}博物馆`, `${city} 博物馆`), verified: false },
      { id: `${city}-snack`, name: `${city}本地特色小吃（待核验）`, category: 'food', area: '老城', tags: ['本地美食', '低预算'], summary: '先给出本地小吃类别，具体门店和价格待实时 POI 核验。', coordinates: center, durationMinutes: 35, price: { min: 15, max: 45, unit: 'person', note: '价格待实时核验' }, source: amapSource(`高德 POI：${city}本地小吃`, `${city} 本地小吃`), verified: false },
      { id: `${city}-restaurant`, name: `${city}本地餐馆（待核验）`, category: 'restaurant', area: '市中心', tags: ['本地美食', '晚餐'], summary: '按预算推荐餐饮档位，具体门店与排队待实时核验。', coordinates: center, durationMinutes: 80, price: { min: 60, max: 140, unit: 'person', note: '人均为规划估算' }, source: amapSource(`高德 POI：${city}本地餐馆`, `${city} 本地菜 餐厅`), verified: false },
    ],
  }
}

export const cityKnowledge: Record<string, CityKnowledge> = { 上海: shanghaiKnowledge, 长沙: changshaKnowledge }

export function getCityKnowledge(city: string): CityKnowledge {
  return cityKnowledge[city] ?? fallbackKnowledge(city)
}

export function selectHotelOption(knowledge: CityKnowledge, budget: number | null, nights: number): HotelOption {
  const options = knowledge.hotelOptions
  if (options.length === 0) throw new Error(`城市 ${knowledge.city} 没有住宿候选。`)
  if (budget === null || nights <= 0) return options[0]
  const nightlyTarget = budget / nights * 0.34
  const affordable = options.filter((option) => option.nightly.min <= nightlyTarget)
  return (affordable.length > 0 ? affordable : options).at(-1) ?? options[0]
}

export function knowledgeMatches(item: CityKnowledgeItem, terms: string[]) {
  const text = [item.name, item.area, item.summary, ...item.tags].join(' ')
  return terms.some((term) => text.includes(term))
}

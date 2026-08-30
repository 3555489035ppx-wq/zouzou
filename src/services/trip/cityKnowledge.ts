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
  /** Coarse food-risk labels used to match explicit dietary constraints. */
  dietaryTags?: string[]
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
      dietaryTags: ['spicy'],
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
      dietaryTags: ['spicy', 'seafood'],
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
      dietaryTags: ['spicy', 'meat'],
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
    {
      id: 'changsha-riverside-morning',
      name: '湘江边晨练与散步',
      category: 'activity',
      area: '湘江东岸',
      tags: ['本地人项目', '晨练', '城市漫步'],
      summary: '把清晨留给江边散步和本地居民日常，不把长沙只安排成夜宵路线。',
      coordinates: [112.967, 28.184],
      durationMinutes: 75,
      price: { min: 0, max: 0, unit: 'person', note: '公共空间，不设固定消费' },
      source: amapSource('高德 POI：长沙湘江沿岸', '长沙 湘江边 晨练 散步'),
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
    { id: 'shanghai-food', name: '本帮菜午餐', category: 'restaurant', area: '静安 / 黄浦', tags: ['本地美食', '午餐'], dietaryTags: ['meat'], summary: '按人均预算选择本帮菜门店，先看实时排队。', coordinates: [121.458, 31.228], durationMinutes: 70, price: { min: 60, max: 120, unit: 'person', note: '人均为规划估算' }, source: amapSource('高德 POI：上海本帮菜', '上海 本帮菜 餐厅'), verified: false },
    { id: 'shanghai-coffee', name: '武康路咖啡休息', category: 'food', area: '徐汇', tags: ['咖啡', '休息'], summary: '把咖啡店作为缓冲，不把它当成必须打卡的硬任务。', coordinates: [121.4385, 31.2145], durationMinutes: 60, price: { min: 35, max: 80, unit: 'person', note: '门店价格按现场菜单为准' }, source: amapSource('高德 POI：武康路咖啡', '上海 武康路 咖啡'), verified: false },
    { id: 'shanghai-market-morning', name: '老城厢菜市场早走', category: 'activity', area: '黄浦老城厢', tags: ['本地人项目', '早市', '市井烟火'], summary: '早晨看社区菜场和老城厢街巷，把上海日常生活放进街区路线。', coordinates: [121.492, 31.225], durationMinutes: 75, price: { min: 0, max: 20, unit: 'person', note: '公共街区，消费取决于早餐和小店' }, source: amapSource('高德 POI：上海老城厢菜市场', '上海 老城厢 菜市场 早市'), verified: false },
  ],
}

type CitySeedSpec = {
  name: string
  category: KnowledgeCategory
  area: string
  tags: string[]
  summary?: string
  coordinates: [number, number]
  durationMinutes?: number
  price?: KnowledgePrice
  dietaryTags?: string[]
}

const citySeedSpecs: Record<string, CitySeedSpec[]> = {
  杭州: [
    { name: '西湖风景名胜区', category: 'attraction', area: '西湖', tags: ['经典', '自然', '城市漫步'], summary: '把断桥、白堤或苏堤选一段走，不建议一天绕湖暴走。', coordinates: [120.148, 30.24], durationMinutes: 180 },
    { name: '灵隐寺', category: 'attraction', area: '灵隐 / 飞来峰', tags: ['人文', '上午', '预约核验'], summary: '适合早上进山，和西湖西线放在同一天，减少往返。', coordinates: [120.101, 30.24], durationMinutes: 150, price: { min: 30, max: 75, unit: 'ticket', note: '门票、预约和飞来峰联票需按当日公告复核' } },
    { name: '西溪国家湿地公园', category: 'attraction', area: '西溪', tags: ['湿地', '自然', '半日'], summary: '比市中心景点更松弛，适合把半天留给摇橹船和湿地步道。', coordinates: [120.06, 30.27], durationMinutes: 180, price: { min: 0, max: 80, unit: 'ticket', note: '园区分区和船票按当日公告复核' } },
    { name: '中国美术学院象山校区', category: 'activity', area: '之江', tags: ['建筑', '艺术', '小众'], summary: '把它当作建筑和校园散步候选，开放边界需到场确认。', coordinates: [120.10, 30.18], durationMinutes: 100 },
    { name: '龙井村—九溪烟树', category: 'activity', area: '西湖西南线', tags: ['茶园', '徒步', '本地人项目'], summary: '茶园、溪谷和村路连起来更有杭州生活感，雨后路滑需注意。', coordinates: [120.13, 30.20], durationMinutes: 150 },
    { name: '河坊街—南宋御街', category: 'activity', area: '上城老城', tags: ['老街', '夜逛', '逛吃'], summary: '适合傍晚慢逛，把小吃和老城建筑放在一条步行线上。', coordinates: [120.17, 30.23], durationMinutes: 110 },
    { name: '片儿川', category: 'food', area: '老城面馆', tags: ['本地小吃', '本地美食', '早餐'], summary: '杭州本地面食，点单时确认咸淡、浇头和是否含肉。', coordinates: [120.17, 30.24], durationMinutes: 35, dietaryTags: ['meat'] },
    { name: '葱包桧', category: 'food', area: '河坊街 / 老城', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '适合街区途中当小点心，不占用整段正餐时间。', coordinates: [120.17, 30.23], durationMinutes: 25 },
    { name: '龙井虾仁', category: 'restaurant', area: '龙井 / 西湖', tags: ['本地美食', '午餐', '杭帮菜'], summary: '经典杭帮菜，海鲜过敏者不要仅凭菜名猜测安全，需向门店确认。', coordinates: [120.13, 30.22], durationMinutes: 70, price: { min: 90, max: 180, unit: 'person', note: '人均为规划估算，按实时菜单为准' }, dietaryTags: ['seafood'] },
    { name: '大马弄—晓霞弄城市漫步', category: 'activity', area: '上城老城', tags: ['本地人项目', '市井烟火', 'City Walk'], summary: '居民区小巷和菜场周边更适合观察日常，不把它包装成固定景点。', coordinates: [120.18, 30.25], durationMinutes: 90 },
  ],
  苏州: [
    { name: '拙政园', category: 'attraction', area: '姑苏区', tags: ['园林', '经典', '上午'], summary: '留出完整游园时间，和苏州博物馆安排在同一片区。', coordinates: [120.439, 31.325], durationMinutes: 150, price: { min: 70, max: 90, unit: 'ticket', note: '预约和当季票价需复核' } },
    { name: '苏州博物馆', category: 'attraction', area: '姑苏区', tags: ['展览', '预约', '室内'], summary: '适合雨天或上午安排，需提前核对预约名额和闭馆日。', coordinates: [120.439, 31.326], durationMinutes: 120, price: { min: 0, max: 0, unit: 'ticket', note: '预约规则按官方公告复核' } },
    { name: '平江路历史街区', category: 'activity', area: '姑苏区', tags: ['老街', '城市漫步', '夜逛'], summary: '沿河慢走，给小店和评弹留时间，避免只在主街拍照。', coordinates: [120.431, 31.322], durationMinutes: 120 },
    { name: '山塘街', category: 'activity', area: '山塘街', tags: ['老街', '夜景', '运河'], summary: '傍晚看水巷和灯影，和虎丘或留园分开安排更轻松。', coordinates: [120.601, 31.316], durationMinutes: 100 },
    { name: '留园', category: 'attraction', area: '留园 / 寒山寺片区', tags: ['园林', '人文', '半日'], summary: '园林尺度紧凑，适合作为拙政园之外的替换项。', coordinates: [120.598, 31.315], durationMinutes: 120, price: { min: 45, max: 70, unit: 'ticket', note: '票价与开放时段需复核' } },
    { name: '双塔市集—葑门横街', category: 'activity', area: '姑苏区', tags: ['本地人项目', '菜市场', '市井烟火'], summary: '早上去看本地菜场和小吃，比网红街更接近日常生活。', coordinates: [120.442, 31.305], durationMinutes: 90 },
    { name: '苏式面', category: 'food', area: '姑苏老城', tags: ['本地小吃', '本地美食', '早餐'], summary: '汤面适合早餐或午间，浇头和汤头口味按门店选择。', coordinates: [120.439, 31.31], durationMinutes: 35 },
    { name: '海棠糕', category: 'food', area: '平江路 / 山塘街', tags: ['本地小吃', '本地美食', '甜点'], summary: '老街途中少量尝试即可，适合和园林步行串联。', coordinates: [120.433, 31.321], durationMinutes: 25 },
    { name: '松鼠桂鱼', category: 'restaurant', area: '姑苏老城', tags: ['本地美食', '晚餐', '苏帮菜'], summary: '苏帮菜代表菜，鱼类属于水产，相关过敏者需要避开并确认厨房交叉接触。', coordinates: [120.438, 31.315], durationMinutes: 80, price: { min: 100, max: 220, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['seafood'] },
    { name: '金鸡湖文化艺术中心', category: 'activity', area: '工业园区', tags: ['现代城市', '夜景', '室内备选'], summary: '古城之外的现代苏州，可根据天气和住宿位置替换。', coordinates: [120.705, 31.318], durationMinutes: 100 },
  ],
  南京: [
    { name: '中山陵', category: 'attraction', area: '钟山风景区', tags: ['人文', '经典', '上午'], summary: '和音乐台、明孝陵放在钟山片区，预留爬坡和接驳时间。', coordinates: [118.848, 32.058], durationMinutes: 150, price: { min: 0, max: 40, unit: 'ticket', note: '预约、接驳和开放状态需按官方公告复核' } },
    { name: '中山陵音乐台', category: 'attraction', area: '钟山风景区', tags: ['建筑', '拍照', '钟山'], summary: '中山陵配套的露天音乐空间，适合和中山陵、灵谷寺同片区安排。', coordinates: [118.846, 32.054], durationMinutes: 75, price: { min: 0, max: 15, unit: 'ticket', note: '门票和客流规则需复核' } },
    { name: '南京博物院', category: 'attraction', area: '玄武区', tags: ['展览', '室内', '预约'], summary: '给历史和艺术留半天，入馆预约、闭馆日和特展票需提前确认。', coordinates: [118.899, 32.042], durationMinutes: 180, price: { min: 0, max: 80, unit: 'ticket', note: '常设展与特展规则不同，按官方公告复核' } },
    { name: '夫子庙—秦淮河', category: 'activity', area: '秦淮区', tags: ['夜景', '老城', '经典'], summary: '傍晚沿河走，把夫子庙、老门东和夜景连成一条线。', coordinates: [118.789, 32.022], durationMinutes: 150 },
    { name: '老门东历史街区', category: 'activity', area: '秦淮区', tags: ['老街', '城市漫步', '逛吃'], summary: '适合白天慢逛和晚餐前后穿行，热门时段注意排队。', coordinates: [118.788, 32.014], durationMinutes: 110 },
    { name: '南京欢乐谷', category: 'activity', area: '栖霞区', tags: ['游乐园', '亲子', '一日'], summary: '如果用户明确想玩游乐园，建议单独留一天，不与钟山硬拼。', coordinates: [118.985, 32.154], durationMinutes: 300, price: { min: 180, max: 260, unit: 'ticket', note: '票价、项目开放和夜场以官方公告为准' } },
    { name: '鸭血粉丝汤', category: 'food', area: '秦淮 / 老城', tags: ['本地小吃', '本地美食', '早餐'], summary: '南京代表性小吃，点单时确认汤底和内脏配料。', coordinates: [118.79, 32.02], durationMinutes: 35, dietaryTags: ['meat'] },
    { name: '盐水鸭', category: 'food', area: '南京老城', tags: ['本地美食', '熟食', '晚餐'], summary: '适合作为外带熟食或正餐配菜，注意禽肉和卤汁成分。', coordinates: [118.79, 32.04], durationMinutes: 30, dietaryTags: ['meat'] },
    { name: '牛肉锅贴', category: 'food', area: '秦淮区', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '适合在老城步行途中少量尝试，牛肉过敏或不吃肉需避开。', coordinates: [118.79, 32.02], durationMinutes: 30, dietaryTags: ['meat'] },
    { name: '先锋书店—颐和路慢走', category: 'activity', area: '鼓楼区', tags: ['本地人项目', '书店', 'City Walk'], summary: '把书店和梧桐街区放在下午，作为钟山和秦淮之外的慢节奏半日。', coordinates: [118.77, 32.06], durationMinutes: 120 },
  ],
  成都: [
    { name: '宽窄巷子', category: 'activity', area: '青羊区', tags: ['老街', '城市漫步', '经典'], summary: '适合早晚错峰走，重点看街巷尺度和院落，不必久留排队店。', coordinates: [104.06, 30.67], durationMinutes: 100 },
    { name: '人民公园', category: 'activity', area: '青羊区', tags: ['本地人项目', '喝茶', '晨练'], summary: '在鹤鸣茶社或湖边坐一会儿，观察成都人的公园日常。', coordinates: [104.06, 30.66], durationMinutes: 100 },
    { name: '武侯祠—锦里', category: 'attraction', area: '武侯区', tags: ['人文', '老街', '半日'], summary: '三国文化和老街可以连续安排，热门时段留出入馆与排队时间。', coordinates: [104.05, 30.65], durationMinutes: 150, price: { min: 0, max: 60, unit: 'ticket', note: '武侯祠票价与预约需复核' } },
    { name: '成都博物馆', category: 'attraction', area: '天府广场', tags: ['展览', '室内', '雨天备选'], summary: '城市历史的室内主线，适合与天府广场、人民公园串联。', coordinates: [104.063, 30.657], durationMinutes: 120, price: { min: 0, max: 50, unit: 'ticket', note: '预约和闭馆日需复核' } },
    { name: '玉林路—九眼桥', category: 'activity', area: '武侯 / 锦江', tags: ['夜生活', '本地人项目', '夜逛'], summary: '傍晚到夜间看成都年轻人的生活片区，避免把它写成单一打卡点。', coordinates: [104.07, 30.63], durationMinutes: 140 },
    { name: '东郊记忆', category: 'activity', area: '成华区', tags: ['艺术', '工业遗址', '演出'], summary: '适合看展、看演出或逛文创店，活动安排需看当日演出单。', coordinates: [104.14, 30.65], durationMinutes: 120 },
    { name: '成都火锅', category: 'restaurant', area: '市区本地火锅店', tags: ['本地美食', '晚餐', '重口味'], summary: '成都代表性体验，不能吃辣者不要只写“鸳鸯锅”，需确认锅底和蘸料是否分开。', coordinates: [104.07, 30.65], durationMinutes: 100, price: { min: 80, max: 160, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['spicy', 'meat'] },
    { name: '担担面', category: 'food', area: '成都老城', tags: ['本地小吃', '本地美食', '早餐'], summary: '面食通常带辣味和肉臊，忌辣或不吃肉需点单前确认。', coordinates: [104.07, 30.66], durationMinutes: 30, dietaryTags: ['spicy', 'meat'] },
    { name: '钟水饺 / 龙抄手', category: 'food', area: '成都老城', tags: ['本地小吃', '本地美食', '午餐'], summary: '两种成都小吃可按口味选择，红油版本对忌辣用户不友好。', coordinates: [104.07, 30.66], durationMinutes: 35, dietaryTags: ['spicy', 'meat'] },
    { name: '盖碗茶与采耳', category: 'activity', area: '人民公园 / 老茶馆', tags: ['本地人项目', '茶馆喝茶', '休息'], summary: '把喝茶和短暂休息作为可选体验，具体店铺和卫生条件现场判断。', coordinates: [104.06, 30.66], durationMinutes: 75 },
  ],
  厦门: [
    { name: '鼓浪屿', category: 'attraction', area: '思明区离岛', tags: ['海岛', '建筑', '半日'], summary: '把轮渡往返和岛上步行算进半日或一日，不要与远郊景点硬拼。', coordinates: [118.07, 24.45], durationMinutes: 240, price: { min: 35, max: 120, unit: 'ticket', note: '船票、航线和岛上预约需复核' } },
    { name: '沙坡尾', category: 'activity', area: '思明区', tags: ['城市漫步', '文艺', '夜逛'], summary: '适合下午到晚上边走边看小店和港口，和中山路距离较近。', coordinates: [118.08, 24.46], durationMinutes: 110 },
    { name: '环岛路—白城沙滩', category: 'activity', area: '环岛路', tags: ['海边', '骑行', '日落'], summary: '天气好时安排海边骑行或散步，风大和涨潮时以现场安全为先。', coordinates: [118.10, 24.44], durationMinutes: 130 },
    { name: '厦门园林植物园', category: 'attraction', area: '万石山', tags: ['自然', '拍照', '半日'], summary: '坡路较多，安排在体力较好的半天，雨后注意湿滑。', coordinates: [118.10, 24.45], durationMinutes: 150, price: { min: 30, max: 50, unit: 'ticket', note: '门票和开放区需复核' } },
    { name: '集美学村', category: 'activity', area: '集美区', tags: ['建筑', '校园', '小众'], summary: '适合喜欢建筑与慢走的人，需单独计算跨岛交通时间。', coordinates: [118.10, 24.57], durationMinutes: 150 },
    { name: '八市早市', category: 'activity', area: '开元路 / 第八市场', tags: ['本地人项目', '早市', '市井烟火'], summary: '早上去看海产市场和本地早餐，海鲜过敏者只逛不吃并避开加工摊位。', coordinates: [118.08, 24.47], durationMinutes: 90 },
    { name: '沙茶面', category: 'food', area: '厦门老城', tags: ['本地小吃', '本地美食', '早餐'], summary: '汤底和配料差异大，海鲜或花生过敏者要逐项向门店确认。', coordinates: [118.08, 24.47], durationMinutes: 35, dietaryTags: ['seafood', 'peanut'] },
    { name: '海蛎煎', category: 'food', area: '八市 / 中山路', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '含贝类海鲜，海鲜过敏或不吃海鲜时直接排除。', coordinates: [118.08, 24.47], durationMinutes: 30, dietaryTags: ['seafood'] },
    { name: '花生汤', category: 'food', area: '厦门老城', tags: ['本地小吃', '本地美食', '甜品'], summary: '甜口小吃，花生过敏者需要避开。', coordinates: [118.08, 24.47], durationMinutes: 25, dietaryTags: ['peanut'] },
    { name: '筼筜湖夜走', category: 'activity', area: '思明区', tags: ['本地人项目', '夜景', '散步'], summary: '本地居民常去的城市水岸散步线，适合晚餐后消化和放空。', coordinates: [118.10, 24.49], durationMinutes: 80 },
  ],
  北京: [
    { name: '故宫博物院', category: 'attraction', area: '东城区', tags: ['历史', '预约', '经典'], summary: '单独留半天以上，预约、入馆时段和闭馆日必须出行前复核。', coordinates: [116.397, 39.916], durationMinutes: 210, price: { min: 40, max: 80, unit: 'ticket', note: '票价和预约以官方公告为准' } },
    { name: '景山公园', category: 'attraction', area: '故宫北侧', tags: ['城市视野', '日落', '低预算'], summary: '适合接在故宫之后看中轴线，不需要再跨区。', coordinates: [116.397, 39.925], durationMinutes: 75, price: { min: 2, max: 10, unit: 'ticket' } },
    { name: '颐和园', category: 'attraction', area: '海淀区', tags: ['皇家园林', '半日', '经典'], summary: '园区大，建议集中走长廊、佛香阁或昆明湖一线。', coordinates: [116.27, 39.99], durationMinutes: 210, price: { min: 20, max: 60, unit: 'ticket', note: '联票和园中园票价需复核' } },
    { name: '798艺术区', category: 'activity', area: '朝阳区', tags: ['展览', '艺术', 'City Walk'], summary: '画廊和公共艺术适合下午慢逛，展馆开放时间各不相同。', coordinates: [116.49, 39.98], durationMinutes: 150 },
    { name: '什刹海—烟袋斜街', category: 'activity', area: '西城区', tags: ['胡同', '夜景', '城市漫步'], summary: '傍晚沿湖和胡同走，比白天连续打卡更有生活感。', coordinates: [116.38, 39.94], durationMinutes: 130 },
    { name: '牛街早市', category: 'activity', area: '西城区', tags: ['本地人项目', '早市', '市井烟火'], summary: '早上观察清真饮食和社区生活，餐饮选择按个人饮食限制逐项确认。', coordinates: [116.37, 39.89], durationMinutes: 90 },
    { name: '北京烤鸭', category: 'restaurant', area: '前门 / 东城', tags: ['本地美食', '晚餐', '经典'], summary: '北京代表性正餐，禽肉和甜面酱配料需按忌口确认。', coordinates: [116.40, 39.90], durationMinutes: 90, price: { min: 100, max: 220, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat'] },
    { name: '炸酱面', category: 'food', area: '胡同 / 社区面馆', tags: ['本地小吃', '本地美食', '午餐'], summary: '传统面食常含肉酱，可询问是否能做素酱或清淡版本。', coordinates: [116.40, 39.94], durationMinutes: 35, dietaryTags: ['meat'] },
    { name: '豆汁', category: 'food', area: '老北京早餐铺', tags: ['本地小吃', '本地美食', '早餐'], summary: '风味辨识度高，适合少量尝试，不必为了“打卡”勉强入口。', coordinates: [116.40, 39.92], durationMinutes: 25 },
    { name: '胡同晨走', category: 'activity', area: '东城 / 西城胡同', tags: ['本地人项目', 'City Walk', '晨练'], summary: '早晨避开拥挤，在居民区边界外慢走，注意不进入私人院落。', coordinates: [116.405, 39.935], durationMinutes: 90 },
  ],
  广州: [
    { name: '广州塔', category: 'attraction', area: '海珠区', tags: ['城市地标', '夜景', '经典'], summary: '可把珠江两岸夜景作为收尾，登塔项目和时段需提前确认。', coordinates: [113.33, 23.11], durationMinutes: 120, price: { min: 0, max: 180, unit: 'ticket', note: '登塔票价和预约以官方公告为准' } },
    { name: '沙面岛', category: 'activity', area: '荔湾区', tags: ['建筑', '城市漫步', '上午'], summary: '适合和西关老城连着走，保留树荫和建筑观察时间。', coordinates: [113.24, 23.11], durationMinutes: 100 },
    { name: '陈家祠', category: 'attraction', area: '荔湾区', tags: ['岭南文化', '展览', '室内'], summary: '岭南建筑和工艺的室内主线，雨天也好安排。', coordinates: [113.25, 23.13], durationMinutes: 100, price: { min: 10, max: 20, unit: 'ticket', note: '开放时段和门票需复核' } },
    { name: '永庆坊—恩宁路', category: 'activity', area: '荔湾区', tags: ['老城', '夜逛', '本地生活'], summary: '骑楼、旧城更新和小店集中，适合下午到晚上慢慢走。', coordinates: [113.24, 23.12], durationMinutes: 120 },
    { name: '白云山', category: 'attraction', area: '白云区', tags: ['自然', '徒步', '半日'], summary: '天气舒适时安排登高，炎热或暴雨时切换到室内路线。', coordinates: [113.30, 23.18], durationMinutes: 180, price: { min: 5, max: 30, unit: 'ticket', note: '索道和园内交通另计，按现场为准' } },
    { name: '东山口—新河浦', category: 'activity', area: '越秀区', tags: ['本地人项目', '骑楼', 'City Walk'], summary: '适合看洋楼、街坊生活和小店，是老广州之外的慢走路线。', coordinates: [113.30, 23.13], durationMinutes: 110 },
    { name: '肠粉', category: 'food', area: '西关 / 社区早餐铺', tags: ['本地小吃', '本地美食', '早餐'], summary: '米浆、酱油和配料差异大，肉类或海鲜配料需点单前确认。', coordinates: [113.25, 23.12], durationMinutes: 30, dietaryTags: ['meat', 'seafood'] },
    { name: '早茶', category: 'restaurant', area: '荔湾 / 越秀', tags: ['本地美食', '早餐', '本地生活'], summary: '广州本地生活的核心体验，点心里常有虾饺、叉烧和蛋奶配料，过敏者逐项确认。', coordinates: [113.26, 23.13], durationMinutes: 100, price: { min: 60, max: 150, unit: 'person', note: '茶位和点心按门店菜单为准' }, dietaryTags: ['seafood', 'meat', 'dairy'] },
    { name: '双皮奶', category: 'food', area: '西关老城', tags: ['本地小吃', '本地美食', '甜品'], summary: '奶制甜品，乳制品过敏者需要避开。', coordinates: [113.25, 23.12], durationMinutes: 25, dietaryTags: ['dairy'] },
    { name: '西关骑楼与菜市场慢走', category: 'activity', area: '荔湾区', tags: ['本地人项目', '市井烟火', '早市'], summary: '早上看骑楼下的社区菜场和早餐铺，优先选择不挡居民通行的路线。', coordinates: [113.24, 23.12], durationMinutes: 90 },
  ],
  重庆: [
    { name: '洪崖洞', category: 'activity', area: '渝中区', tags: ['夜景', '城市地标', '经典'], summary: '建议日落前后抵达，山城坡道和人流会显著影响耗时。', coordinates: [106.58, 29.56], durationMinutes: 120 },
    { name: '解放碑—十八梯', category: 'activity', area: '渝中区', tags: ['老城', '城市漫步', '夜逛'], summary: '把解放碑、十八梯和较场口安排在同一片区，少做跨江折返。', coordinates: [106.58, 29.56], durationMinutes: 130 },
    { name: '长江索道', category: 'attraction', area: '渝中 / 南岸', tags: ['交通体验', '城市景观', '预约核验'], summary: '是交通与观景结合的体验，排队和运营状态必须当天确认。', coordinates: [106.59, 29.56], durationMinutes: 90, price: { min: 20, max: 40, unit: 'ticket', note: '预约与运营状态需复核' } },
    { name: '磁器口古镇', category: 'activity', area: '沙坪坝区', tags: ['老街', '半日', '经典'], summary: '主街人多，可沿支巷和江边走，注意网红店与本地店差异。', coordinates: [106.45, 29.58], durationMinutes: 130 },
    { name: '鹅岭二厂', category: 'activity', area: '渝中区', tags: ['艺术', '城市视野', '拍照'], summary: '适合下午看城市高差和旧厂房更新，和夜景路线相邻。', coordinates: [106.54, 29.56], durationMinutes: 100 },
    { name: '南山一棵树', category: 'activity', area: '南岸区', tags: ['夜景', '本地人项目', '观景'], summary: '看重庆全景的备选点，山路交通耗时需要留足缓冲。', coordinates: [106.59, 29.54], durationMinutes: 100, price: { min: 0, max: 30, unit: 'ticket' } },
    { name: '重庆火锅', category: 'restaurant', area: '社区火锅店', tags: ['本地美食', '晚餐', '重口味'], summary: '麻辣锅底是核心特征，忌辣用户不能只依赖鸳鸯锅，要确认独立锅底和蘸料。', coordinates: [106.57, 29.56], durationMinutes: 100, price: { min: 80, max: 170, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['spicy', 'meat'] },
    { name: '重庆小面', category: 'food', area: '居民区面馆', tags: ['本地小吃', '本地美食', '早餐'], summary: '佐料通常含油辣子和花椒，不能吃辣时必须确认是否可完全去辣。', coordinates: [106.57, 29.56], durationMinutes: 30, dietaryTags: ['spicy', 'meat', 'peanut'] },
    { name: '酸辣粉 / 冰粉', category: 'food', area: '解放碑 / 社区小店', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '酸辣粉偏辣，冰粉可作为饭后缓冲，点单时确认配料。', coordinates: [106.58, 29.56], durationMinutes: 35, dietaryTags: ['spicy', 'peanut'] },
    { name: '梯坎步行与社区茶馆', category: 'activity', area: '山城老街', tags: ['本地人项目', '茶馆喝茶', 'City Walk'], summary: '沿居民区公共道路走坡坎，再找正规茶馆休息，不把私人空间当景点。', coordinates: [106.56, 29.55], durationMinutes: 100 },
  ],
  西安: [
    { name: '西安城墙', category: 'attraction', area: '碑林 / 城墙', tags: ['历史', '骑行', '经典'], summary: '可步行或骑行一段，不必完整绕城，注意夏季暴晒和风力。', coordinates: [108.95, 34.25], durationMinutes: 150, price: { min: 50, max: 100, unit: 'ticket', note: '骑行和开放时段需复核' } },
    { name: '钟楼—鼓楼', category: 'attraction', area: '莲湖区', tags: ['城市地标', '夜景', '经典'], summary: '傍晚看中轴线灯光，和回民街、洒金桥可以步行串联。', coordinates: [108.95, 34.26], durationMinutes: 90, price: { min: 0, max: 50, unit: 'ticket', note: '登楼票价和开放时段需复核' } },
    { name: '陕西历史博物馆', category: 'attraction', area: '雁塔区', tags: ['展览', '预约', '室内'], summary: '建议提前预约并单独留半天，特展和基本陈列规则可能不同。', coordinates: [109.00, 34.22], durationMinutes: 180, price: { min: 0, max: 80, unit: 'ticket', note: '预约和特展票需复核' } },
    { name: '大雁塔—大唐不夜城', category: 'activity', area: '曲江新区', tags: ['夜景', '人文', '夜逛'], summary: '下午到晚上安排更顺，演出时间和客流按当天公告确认。', coordinates: [108.99, 34.22], durationMinutes: 180 },
    { name: '兵马俑', category: 'attraction', area: '临潼区', tags: ['历史', '远郊', '一日'], summary: '需要单独计算往返交通，适合把东线作为一天主线。', coordinates: [109.28, 34.38], durationMinutes: 210, price: { min: 120, max: 180, unit: 'ticket', note: '门票与接驳需复核' } },
    { name: '洒金桥早市', category: 'activity', area: '莲湖区', tags: ['本地人项目', '早市', '市井烟火'], summary: '早上逛社区小吃和街巷，再步行到钟鼓楼片区，避开正午拥挤。', coordinates: [108.94, 34.27], durationMinutes: 100 },
    { name: '肉夹馍', category: 'food', area: '西安老城', tags: ['本地小吃', '本地美食', '早餐'], summary: '常见为猪肉或牛肉版本，不吃肉或清真需求要按门店确认。', coordinates: [108.95, 34.26], durationMinutes: 30, dietaryTags: ['meat', 'pork'] },
    { name: '羊肉泡馍', category: 'restaurant', area: '回民街 / 洒金桥', tags: ['本地美食', '午餐', '传统'], summary: '羊肉和汤底是核心，清真门店、配料和等位时间需现场确认。', coordinates: [108.95, 34.27], durationMinutes: 80, price: { min: 45, max: 100, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat'] },
    { name: '凉皮', category: 'food', area: '西安社区小店', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '调味常带辣油，忌辣用户要确认能否完全去辣。', coordinates: [108.95, 34.27], durationMinutes: 25, dietaryTags: ['spicy'] },
    { name: '城墙骑行—永兴坊夜逛', category: 'activity', area: '城墙东侧', tags: ['本地人项目', '骑行', '夜逛'], summary: '把城墙运动和老城小吃分开计算体力，避免一天安排过满。', coordinates: [108.96, 34.25], durationMinutes: 120 },
  ],
  深圳: [
    { name: '南头古城', category: 'activity', area: '南山区', tags: ['老城', '城市漫步', '本地生活'], summary: '看旧城、展览和新店混合的街区，适合半天慢逛。', coordinates: [113.93, 22.54], durationMinutes: 120 },
    { name: '深圳湾公园', category: 'activity', area: '南山区', tags: ['海边', '骑行', '日落'], summary: '沿海岸线散步或骑行，风雨和潮汐以当天安全提示为准。', coordinates: [113.97, 22.52], durationMinutes: 130 },
    { name: '莲花山公园', category: 'activity', area: '福田区', tags: ['城市视野', '晨练', '免费'], summary: '早晨看市民晨练和城市中轴线，适合低成本开场。', coordinates: [114.05, 22.55], durationMinutes: 90 },
    { name: '华侨城创意文化园', category: 'activity', area: '南山区', tags: ['艺术', '展览', 'City Walk'], summary: '园区店铺和展览更适合下午，具体开门时间按门店确认。', coordinates: [113.97, 22.54], durationMinutes: 120 },
    { name: '世界之窗', category: 'attraction', area: '南山区', tags: ['主题乐园', '亲子', '一日'], summary: '如果用户想玩主题乐园，建议作为独立半日或一日安排。', coordinates: [113.97, 22.54], durationMinutes: 240, price: { min: 180, max: 260, unit: 'ticket', note: '票价和项目开放需复核' } },
    { name: '大鹏所城', category: 'activity', area: '龙岗区', tags: ['古城', '远郊', '本地人项目'], summary: '适合喜欢海边与古城的人，但跨区交通时间很长，不和市中心硬拼。', coordinates: [114.48, 22.59], durationMinutes: 180 },
    { name: '潮汕牛肉火锅', category: 'restaurant', area: '深圳社区餐馆', tags: ['本地美食', '晚餐', '潮汕饮食'], summary: '牛肉和汤底为主，不能吃肉者需避开；蘸料配料需确认。', coordinates: [114.06, 22.54], durationMinutes: 90, price: { min: 90, max: 180, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat'] },
    { name: '肠粉', category: 'food', area: '社区早餐铺', tags: ['本地小吃', '本地美食', '早餐'], summary: '蛋、肉、虾等配料常见，过敏者按门店菜单逐项确认。', coordinates: [114.06, 22.54], durationMinutes: 30, dietaryTags: ['meat', 'seafood'] },
    { name: '椰子鸡', category: 'restaurant', area: '深圳湾 / 福田', tags: ['本地美食', '晚餐', '清淡'], summary: '鸡肉和椰子汤底相对清淡，但仍属于禽肉，忌口者先确认。', coordinates: [114.04, 22.53], durationMinutes: 90, price: { min: 80, max: 160, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat'] },
    { name: '水围夜市—社区骑行', category: 'activity', area: '福田区', tags: ['本地人项目', '夜市', '骑行'], summary: '晚上体验城中村与社区夜生活，优先选择明亮公共道路和正规商户。', coordinates: [114.07, 22.53], durationMinutes: 100 },
  ],
  青岛: [
    { name: '栈桥—浙江路老城区', category: 'activity', area: '市南区', tags: ['海边', '建筑', '经典'], summary: '沿海边和老城街巷慢走，天气和风力会影响体感。', coordinates: [120.32, 36.06], durationMinutes: 120 },
    { name: '八大关', category: 'activity', area: '市南区', tags: ['建筑', '城市漫步', '秋色'], summary: '适合白天慢走看街区和树影，避免与崂山同日跨城。', coordinates: [120.35, 36.05], durationMinutes: 120 },
    { name: '小麦岛公园', category: 'activity', area: '崂山区', tags: ['海边', '日落', '本地人项目'], summary: '看海和日落的开放空间，风大时注意防滑和保暖。', coordinates: [120.40, 36.06], durationMinutes: 100 },
    { name: '青岛啤酒博物馆', category: 'attraction', area: '市北区', tags: ['展览', '工业遗产', '室内'], summary: '适合了解城市啤酒工业史，酒精敏感者只参观不饮用。', coordinates: [120.35, 36.08], durationMinutes: 120, price: { min: 50, max: 80, unit: 'ticket', note: '票价和预约需复核' }, dietaryTags: ['alcohol'] },
    { name: '崂山风景区', category: 'attraction', area: '崂山区', tags: ['自然', '徒步', '远郊'], summary: '需要单独安排半日或一日，山海线路按体力和天气取舍。', coordinates: [120.62, 36.20], durationMinutes: 240, price: { min: 0, max: 180, unit: 'ticket', note: '门票、观光车和索道按当日公告复核' } },
    { name: '台东夜市—大学路', category: 'activity', area: '市北 / 市南', tags: ['夜市', '老街', '逛吃'], summary: '把夜市和文艺街区分开体验，热门时段不承诺固定排队时间。', coordinates: [120.35, 36.08], durationMinutes: 120 },
    { name: '排骨米饭', category: 'food', area: '青岛社区餐馆', tags: ['本地小吃', '本地美食', '午餐'], summary: '青岛常见本地饭食，排骨属于肉类，忌口者需避开。', coordinates: [120.35, 36.07], durationMinutes: 45, dietaryTags: ['meat'] },
    { name: '鲅鱼饺子', category: 'food', area: '市南老城', tags: ['本地美食', '晚餐', '海味'], summary: '鱼类水产，海鲜过敏者直接排除并注意厨房交叉接触。', coordinates: [120.34, 36.07], durationMinutes: 60, price: { min: 50, max: 100, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['seafood'] },
    { name: '青岛啤酒', category: 'food', area: '啤酒街 / 台东', tags: ['本地美食', '饮品', '夜生活'], summary: '酒精饮品，只作为可选体验，不默认加入每个人的行程。', coordinates: [120.35, 36.08], durationMinutes: 40, dietaryTags: ['alcohol'] },
    { name: '海边骑行与早市', category: 'activity', area: '市南 / 市北', tags: ['本地人项目', '骑行', '早市'], summary: '早晨沿海边和社区市场走一段，海鲜摊位只逛不吃也可保留体验。', coordinates: [120.36, 36.07], durationMinutes: 100 },
  ],
  武汉: [
    { name: '黄鹤楼', category: 'attraction', area: '武昌区', tags: ['城市地标', '历史', '经典'], summary: '与长江大桥、户部巷安排在同一片区，留意台阶与客流。', coordinates: [114.30, 30.54], durationMinutes: 120, price: { min: 50, max: 80, unit: 'ticket', note: '票价和预约需按官方公告复核' } },
    { name: '东湖风景区—东湖绿道', category: 'activity', area: '武昌区', tags: ['自然', '骑行', '本地人项目'], summary: '东湖很大，按听涛、凌波门或磨山选一段，不建议一天全覆盖。', coordinates: [114.36, 30.56], durationMinutes: 180, price: { min: 0, max: 60, unit: 'person', note: '租车和园内交通按现场为准' } },
    { name: '湖北省博物馆', category: 'attraction', area: '东湖路', tags: ['展览', '预约', '室内'], summary: '曾侯乙编钟等荆楚文物是室内主线，预约和闭馆日必须提前核对。', coordinates: [114.36, 30.56], durationMinutes: 150, price: { min: 0, max: 0, unit: 'ticket', note: '实名预约规则按官方公告复核' } },
    { name: '昙华林历史街区', category: 'activity', area: '武昌区', tags: ['老街', '城市漫步', '小店'], summary: '适合下午慢走看老建筑和小店，可与粮道街顺路安排。', coordinates: [114.31, 30.55], durationMinutes: 100 },
    { name: '江汉路步行街—汉口江滩', category: 'activity', area: '汉口老城', tags: ['夜景', '老城', '城市漫步'], summary: '白天逛江汉路，傍晚到江滩，避免武昌汉口之间反复折返。', coordinates: [114.29, 30.59], durationMinutes: 150 },
    { name: '武汉欢乐谷', category: 'activity', area: '东湖片区', tags: ['游乐园', '亲子', '一日'], summary: '明确想玩游乐园时单独留一天，和东湖其他线路择一安排。', coordinates: [114.39, 30.59], durationMinutes: 300, price: { min: 180, max: 260, unit: 'ticket', note: '票价和项目开放以官方公告为准' } },
    { name: '热干面', category: 'food', area: '武汉社区早餐铺', tags: ['本地小吃', '本地美食', '过早'], summary: '武汉过早代表，芝麻酱和调味明显，忌辣时点单确认是否可去辣。', coordinates: [114.30, 30.59], durationMinutes: 30, dietaryTags: ['spicy'] },
    { name: '三鲜豆皮', category: 'food', area: '武昌 / 汉口老城', tags: ['本地小吃', '本地美食', '过早'], summary: '糯米和豆皮为主，常见馅料可能含肉，素食需逐店确认。', coordinates: [114.31, 30.55], durationMinutes: 35, dietaryTags: ['meat'] },
    { name: '面窝—糊汤粉', category: 'food', area: '武汉过早片区', tags: ['本地小吃', '本地美食', '早餐'], summary: '适合和过早一起规划，糊汤粉可能含鱼汤或水产配料，海鲜过敏要问清汤底。', coordinates: [114.30, 30.58], durationMinutes: 35, dietaryTags: ['seafood'] },
    { name: '粮道街过早—大成路早市', category: 'activity', area: '武昌 / 汉口', tags: ['本地人项目', '早市', '市井烟火'], summary: '“过早”本身是武汉本地生活项目，建议早起去居民区早餐铺，不只去网红街。', coordinates: [114.31, 30.55], durationMinutes: 100 },
  ],
  昆明: [
    { name: '翠湖公园', category: 'activity', area: '五华区', tags: ['本地人项目', '晨练', '城市漫步'], summary: '早晨看本地人遛弯、喂海鸥或练习，季节性活动需按现场确认。', coordinates: [102.83, 24.88], durationMinutes: 100 },
    { name: '滇池海埂公园', category: 'activity', area: '西山区', tags: ['湖景', '日落', '自然'], summary: '把滇池只安排一段岸线，傍晚风大时注意保暖。', coordinates: [102.65, 24.96], durationMinutes: 140 },
    { name: '云南省博物馆', category: 'attraction', area: '官渡区', tags: ['展览', '室内', '雨天备选'], summary: '适合了解云南多民族历史，预约和闭馆日需出行前确认。', coordinates: [102.75, 24.95], durationMinutes: 150, price: { min: 0, max: 50, unit: 'ticket', note: '预约规则按官方公告复核' } },
    { name: '斗南花市', category: 'activity', area: '呈贡区', tags: ['花市', '本地生活', '夜逛'], summary: '花市离主城较远，最好和呈贡片区其他活动合并安排。', coordinates: [102.75, 24.89], durationMinutes: 150 },
    { name: '云南民族村', category: 'attraction', area: '滇池片区', tags: ['民族文化', '半日', '室外'], summary: '适合想集中了解云南地域文化的用户，园区较大要控制停留数量。', coordinates: [102.66, 24.96], durationMinutes: 210, price: { min: 80, max: 100, unit: 'ticket', note: '演出和票价按当日公告复核' } },
    { name: '昆明老街—文林街', category: 'activity', area: '五华区', tags: ['老街', '咖啡', '城市漫步'], summary: '老城、书店和小店适合慢走，和翠湖步行距离相对友好。', coordinates: [102.83, 24.88], durationMinutes: 120 },
    { name: '过桥米线', category: 'food', area: '昆明老城', tags: ['本地小吃', '本地美食', '午餐'], summary: '汤和配菜分开上桌，肉类和菌类配料需按个人限制确认。', coordinates: [102.83, 24.88], durationMinutes: 45, dietaryTags: ['meat'] },
    { name: '小锅米线', category: 'food', area: '社区米线铺', tags: ['本地小吃', '本地美食', '早餐'], summary: '本地日常感更强，常见肉酱和辣椒，忌辣或素食需点单确认。', coordinates: [102.83, 24.88], durationMinutes: 35, dietaryTags: ['spicy', 'meat'] },
    { name: '饵块—鲜花饼', category: 'food', area: '昆明老街', tags: ['本地小吃', '本地美食', '伴手礼'], summary: '适合边走边吃或带走，鲜花饼具体馅料和坚果配料需要看包装。', coordinates: [102.83, 24.88], durationMinutes: 30 },
    { name: '官渡古镇早市', category: 'activity', area: '官渡区', tags: ['本地人项目', '早市', '老城'], summary: '早上逛古镇周边居民市场和小吃，不把古镇主街全部当作必去。', coordinates: [102.75, 24.95], durationMinutes: 100 },
  ],
  三亚: [
    { name: '亚龙湾', category: 'activity', area: '吉阳区', tags: ['海滩', '自然', '半日'], summary: '海滩活动受天气、风浪和潮汐影响，按当天安全提示调整。', coordinates: [109.65, 18.23], durationMinutes: 180 },
    { name: '椰梦长廊', category: 'activity', area: '三亚湾', tags: ['海边', '日落', '城市漫步'], summary: '适合傍晚散步看日落，和市区晚餐安排在同一晚更顺。', coordinates: [109.48, 18.25], durationMinutes: 120 },
    { name: '鹿回头风景区', category: 'attraction', area: '吉阳区', tags: ['城市视野', '夜景', '观景'], summary: '俯瞰三亚湾的观景点，山路和接驳时间要留缓冲。', coordinates: [109.50, 18.22], durationMinutes: 120, price: { min: 0, max: 45, unit: 'ticket', note: '门票和接驳按当日公告复核' } },
    { name: '蜈支洲岛', category: 'attraction', area: '海棠区', tags: ['海岛', '水上活动', '一日'], summary: '船程、排队和水上项目会占用一整天，不能和市区景点硬拼。', coordinates: [109.76, 18.31], durationMinutes: 300, price: { min: 140, max: 250, unit: 'ticket', note: '船票和项目价格需复核' } },
    { name: '南山文化旅游区', category: 'attraction', area: '崖州区', tags: ['人文', '远郊', '一日'], summary: '距离主城较远，按用户是否明确想看佛教文化决定是否加入。', coordinates: [109.20, 18.30], durationMinutes: 240, price: { min: 100, max: 130, unit: 'ticket', note: '门票和园内交通按官方公告复核' } },
    { name: '第一市场—大东海夜走', category: 'activity', area: '吉阳区', tags: ['本地人项目', '夜市', '市井烟火'], summary: '可观察市场和夜生活，但海鲜摊位对过敏用户只建议逛不吃。', coordinates: [109.51, 18.25], durationMinutes: 120 },
    { name: '椰子鸡', category: 'restaurant', area: '大东海 / 三亚湾', tags: ['本地美食', '晚餐', '清淡'], summary: '海南代表性餐饮，鸡肉属于禽肉，忌口者先确认；汤底不等于素食。', coordinates: [109.51, 18.25], durationMinutes: 90, price: { min: 80, max: 170, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat'] },
    { name: '清补凉', category: 'food', area: '三亚老城', tags: ['本地小吃', '本地美食', '甜品'], summary: '热带甜品，常见椰奶或奶制配料，过敏者按店内配方确认。', coordinates: [109.51, 18.25], durationMinutes: 30, dietaryTags: ['dairy'] },
    { name: '抱罗粉', category: 'food', area: '海南本地粉店', tags: ['本地小吃', '本地美食', '早餐'], summary: '粉食配料常见肉类或海味，过敏和素食需求需要逐店确认。', coordinates: [109.51, 18.25], durationMinutes: 35, dietaryTags: ['meat', 'seafood'] },
    { name: '凤凰岛—海边骑行', category: 'activity', area: '三亚湾', tags: ['本地人项目', '骑行', '夜景'], summary: '把骑行作为低强度海边体验，避开中午高温和暴晒。', coordinates: [109.50, 18.24], durationMinutes: 100 },
  ],
  桂林: [
    { name: '象鼻山公园', category: 'attraction', area: '象山景区', tags: ['城市地标', '山水', '经典'], summary: '桂林市区短线景点，适合和两江四湖、东西巷连成半日。', coordinates: [110.30, 25.27], durationMinutes: 100, price: { min: 0, max: 75, unit: 'ticket', note: '门票和预约需复核' } },
    { name: '两江四湖', category: 'activity', area: '桂林市区', tags: ['夜景', '水岸', '城市漫步'], summary: '可步行或选择游船，按预算和天气决定，不把两种方式都硬塞。', coordinates: [110.30, 25.28], durationMinutes: 130, price: { min: 0, max: 200, unit: 'ticket', note: '船票和班次需复核' } },
    { name: '漓江山水游', category: 'attraction', area: '桂林—阳朔', tags: ['山水', '远郊', '一日'], summary: '船班、码头和接驳是固定约束，预留整天更可执行。', coordinates: [110.40, 25.25], durationMinutes: 300, price: { min: 200, max: 500, unit: 'ticket', note: '船票、码头和接驳按预订确认' } },
    { name: '阳朔西街', category: 'activity', area: '阳朔县', tags: ['老街', '夜逛', '逛吃'], summary: '适合夜间慢逛，但节假日人流和噪音需要提前告知。', coordinates: [110.49, 24.78], durationMinutes: 110 },
    { name: '遇龙河—十里画廊', category: 'activity', area: '阳朔县', tags: ['自然', '骑行', '本地人项目'], summary: '按天气和体力选择骑行、竹筏或只走一段，不建议多项目叠加。', coordinates: [110.45, 24.78], durationMinutes: 180, price: { min: 0, max: 300, unit: 'person', note: '竹筏、租车和接驳价格需复核' } },
    { name: '龙脊梯田', category: 'attraction', area: '龙胜县', tags: ['山地', '远郊', '一日'], summary: '远郊且路程长，适合单独一日或过夜，不和阳朔同天安排。', coordinates: [110.14, 25.80], durationMinutes: 300, price: { min: 80, max: 150, unit: 'ticket', note: '门票和景区接驳需复核' } },
    { name: '桂林米粉', category: 'food', area: '桂林社区米粉店', tags: ['本地小吃', '本地美食', '早餐'], summary: '市区早餐主线，卤水、肉类和辣椒可按个人需求调整。', coordinates: [110.30, 25.27], durationMinutes: 30, dietaryTags: ['meat', 'spicy'] },
    { name: '啤酒鱼', category: 'restaurant', area: '阳朔西街 / 漓江边', tags: ['本地美食', '晚餐', '阳朔'], summary: '鱼类水产，海鲜过敏者需要避开；啤酒属于酒精，饮酒限制者也要排除。', coordinates: [110.49, 24.78], durationMinutes: 90, price: { min: 70, max: 150, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['seafood', 'alcohol'] },
    { name: '马蹄糕—桂花糕', category: 'food', area: '桂林老城', tags: ['本地小吃', '本地美食', '甜点'], summary: '适合街区途中少量尝试，具体配方和过敏原看门店说明。', coordinates: [110.30, 25.28], durationMinutes: 25 },
    { name: '西街夜逛—阳朔菜市', category: 'activity', area: '阳朔县', tags: ['本地人项目', '夜逛', '菜市场'], summary: '白天看山水，傍晚逛居民菜市和河边，再决定是否进西街主街。', coordinates: [110.49, 24.78], durationMinutes: 100 },
  ],
  哈尔滨: [
    { name: '中央大街', category: 'activity', area: '道里区', tags: ['建筑', '老街', '经典'], summary: '适合白天到夜间连续慢走，冬季冰雪路面要把步行速度算慢。', coordinates: [126.64, 45.76], durationMinutes: 120 },
    { name: '圣索菲亚教堂', category: 'attraction', area: '道里区', tags: ['建筑', '城市地标', '拍照'], summary: '和中央大街、兆麟公园相邻，适合安排在同一段老城路线。', coordinates: [126.63, 45.75], durationMinutes: 75, price: { min: 0, max: 30, unit: 'ticket', note: '开放和入内规则需复核' } },
    { name: '太阳岛风景区', category: 'activity', area: '松北区', tags: ['自然', '冰雪', '半日'], summary: '冬夏体验差异大，按季节选择冰雪项目或湿地散步。', coordinates: [126.60, 45.80], durationMinutes: 180, price: { min: 0, max: 200, unit: 'ticket', note: '季节活动和票价需复核' } },
    { name: '冰雪大世界', category: 'activity', area: '松北区', tags: ['冰雪', '夜景', '一日'], summary: '只在开放季节安排，开放日期、夜场和客流以官方公告为准。', coordinates: [126.57, 45.82], durationMinutes: 240, price: { min: 300, max: 400, unit: 'ticket', note: '季节性项目，价格和开放日期需复核' } },
    { name: '老道外中华巴洛克', category: 'activity', area: '道外区', tags: ['老城', '建筑', '本地人项目'], summary: '看老建筑和社区小店，和中央大街是不同的城市面貌。', coordinates: [126.65, 45.78], durationMinutes: 120 },
    { name: '红专街早市', category: 'activity', area: '道里区', tags: ['早市', '本地人项目', '市井烟火'], summary: '早上体验社区市场和早餐，冬季尽量缩短室外暴露时间。', coordinates: [126.63, 45.75], durationMinutes: 90 },
    { name: '锅包肉', category: 'restaurant', area: '老道外 / 道里', tags: ['本地美食', '午餐', '东北菜'], summary: '传统东北菜代表，通常含猪肉，不吃猪肉时直接排除。', coordinates: [126.65, 45.77], durationMinutes: 75, price: { min: 50, max: 110, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['meat', 'pork'] },
    { name: '红肠—大列巴', category: 'food', area: '中央大街 / 老道外', tags: ['本地美食', '伴手礼', '街头小吃'], summary: '适合当作伴手礼或轻食，红肠为肉类，大列巴配方按包装确认。', coordinates: [126.64, 45.76], durationMinutes: 30, dietaryTags: ['meat'] },
    { name: '马迭尔冰棍', category: 'food', area: '中央大街', tags: ['本地小吃', '本地美食', '甜品'], summary: '冷饮和乳制品，冬季食用按个人耐受度决定。', coordinates: [126.64, 45.76], durationMinutes: 20, dietaryTags: ['dairy'] },
    { name: '老道外澡堂体验', category: 'activity', area: '道外区', tags: ['本地人项目', '洗浴体验', '休息'], summary: '作为冬季保暖与休息的备选，选择正规场所并先确认营业状态。', coordinates: [126.65, 45.78], durationMinutes: 120, price: { min: 40, max: 150, unit: 'person', note: '场所与服务价格需实时确认' } },
  ],
  贵阳: [
    { name: '甲秀楼', category: 'attraction', area: '南明区', tags: ['城市地标', '夜景', '经典'], summary: '适合傍晚看桥、楼和河岸灯光，和青云市集可以顺路。', coordinates: [106.71, 26.57], durationMinutes: 90, price: { min: 0, max: 20, unit: 'ticket', note: '开放状态需复核' } },
    { name: '黔灵山公园', category: 'activity', area: '云岩区', tags: ['自然', '晨练', '本地人项目'], summary: '早晨看城市公园日常，山路和猴群区域注意安全与文明游览。', coordinates: [106.69, 26.60], durationMinutes: 120, price: { min: 0, max: 10, unit: 'ticket' } },
    { name: '贵州省博物馆', category: 'attraction', area: '观山湖区', tags: ['展览', '室内', '预约'], summary: '作为雨天和高温备选，预约、闭馆日和特展需提前确认。', coordinates: [106.62, 26.65], durationMinutes: 150, price: { min: 0, max: 60, unit: 'ticket', note: '预约规则按官方公告复核' } },
    { name: '青云市集', category: 'activity', area: '南明区', tags: ['夜市', '本地生活', '逛吃'], summary: '晚上看本地夜生活和小吃摊，忌辣和过敏用户逐项问配料。', coordinates: [106.71, 26.57], durationMinutes: 120 },
    { name: '青岩古镇', category: 'activity', area: '花溪区', tags: ['古镇', '远郊', '半日'], summary: '离市区有距离，适合单独半日，别和观山湖多个点硬拼。', coordinates: [106.68, 26.38], durationMinutes: 180, price: { min: 0, max: 60, unit: 'ticket', note: '联票和开放状态需复核' } },
    { name: '花溪公园—十里滩', category: 'activity', area: '花溪区', tags: ['自然', '骑行', '本地人项目'], summary: '适合天气舒适时慢走或骑行，作为贵阳本地生活感路线。', coordinates: [106.67, 26.43], durationMinutes: 130 },
    { name: '肠旺面', category: 'food', area: '贵阳社区面馆', tags: ['本地小吃', '本地美食', '早餐'], summary: '常见猪血、肥肠等配料，不吃内脏或猪肉需明确避开。', coordinates: [106.71, 26.58], durationMinutes: 35, dietaryTags: ['meat', 'pork'] },
    { name: '丝娃娃', category: 'food', area: '贵阳老城', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '蔬菜包裹薄饼，蘸水可能很辣，忌辣者要确认是否可做清淡。', coordinates: [106.71, 26.58], durationMinutes: 35, dietaryTags: ['spicy'] },
    { name: '酸汤鱼', category: 'restaurant', area: '贵阳本地餐馆', tags: ['本地美食', '晚餐', '贵州菜'], summary: '鱼类水产且汤底可能带辣，海鲜或忌辣用户直接排除或逐项确认。', coordinates: [106.71, 26.58], durationMinutes: 90, price: { min: 80, max: 160, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['seafood', 'spicy'] },
    { name: '黔灵山晨练—菜市逛吃', category: 'activity', area: '云岩区', tags: ['本地人项目', '晨练', '菜市场'], summary: '把公园晨练和居民菜场早餐结合，体验比单看地标更贴近日常。', coordinates: [106.70, 26.60], durationMinutes: 100 },
  ],
  张家界: [
    { name: '天门山国家森林公园', category: 'attraction', area: '永定区', tags: ['山地', '经典', '一日'], summary: '索道、扶梯和山路受天气影响明显，门票和线路必须按当天公告确认。', coordinates: [110.48, 29.12], durationMinutes: 300, price: { min: 230, max: 300, unit: 'ticket', note: '票价、索道和开放线路需复核' } },
    { name: '武陵源风景名胜区', category: 'attraction', area: '武陵源区', tags: ['山水', '徒步', '一日'], summary: '景区范围很大，建议至少留一整天并明确从哪个门进入。', coordinates: [110.55, 29.35], durationMinutes: 360, price: { min: 200, max: 300, unit: 'ticket', note: '门票有效期和环保车需复核' } },
    { name: '金鞭溪', category: 'activity', area: '武陵源', tags: ['溪谷', '徒步', '自然'], summary: '相对平缓的溪谷线，适合在大景区内作为半日主线。', coordinates: [110.54, 29.32], durationMinutes: 180 },
    { name: '袁家界—阿凡达取景地', category: 'attraction', area: '武陵源', tags: ['山景', '经典', '观景'], summary: '观景台之间依赖环保车和步行，旺季排队时间需要留足。', coordinates: [110.54, 29.39], durationMinutes: 180 },
    { name: '张家界大峡谷玻璃桥', category: 'attraction', area: '慈利县', tags: ['峡谷', '刺激项目', '远郊'], summary: '恐高或不喜欢刺激项目时可直接替换，不与天门山重复安排。', coordinates: [110.68, 29.42], durationMinutes: 240, price: { min: 180, max: 300, unit: 'ticket', note: '项目组合和预约需复核' } },
    { name: '大庸古城—溪布街', category: 'activity', area: '永定区 / 武陵源', tags: ['夜逛', '本地生活', '老街'], summary: '作为景区之外的晚间活动，注意两地并不在同一片区。', coordinates: [110.48, 29.12], durationMinutes: 120 },
    { name: '三下锅', category: 'restaurant', area: '张家界市区', tags: ['本地美食', '晚餐', '湘西菜'], summary: '常见肉类和偏重口味，忌辣或不吃肉用户要排除。', coordinates: [110.48, 29.12], durationMinutes: 90, price: { min: 60, max: 130, unit: 'person', note: '人均为规划估算' }, dietaryTags: ['spicy', 'meat'] },
    { name: '土家腊肉', category: 'food', area: '武陵源 / 市区', tags: ['本地美食', '伴手礼', '湘西菜'], summary: '腌制猪肉制品，不吃猪肉或清真需求直接避开。', coordinates: [110.55, 29.35], durationMinutes: 30, dietaryTags: ['meat', 'pork'] },
    { name: '米豆腐', category: 'food', area: '武陵源小吃铺', tags: ['本地小吃', '本地美食', '随走随吃'], summary: '豆制小吃，拌料可能含辣，点单时确认调味。', coordinates: [110.55, 29.35], durationMinutes: 25, dietaryTags: ['spicy'] },
    { name: '武陵源早市—土家织锦体验', category: 'activity', area: '武陵源区', tags: ['本地人项目', '早市', '非遗体验'], summary: '把早餐、集市和手工艺体验作为景区之外的半日，具体活动按现场确认。', coordinates: [110.55, 29.35], durationMinutes: 100 },
  ],
}

function seedPrice(spec: CitySeedSpec): KnowledgePrice {
  if (spec.price) return spec.price
  if (spec.category === 'food') return { min: 8, max: 45, unit: 'person', note: '价格待实时菜单核验' }
  if (spec.category === 'restaurant') return { min: 50, max: 140, unit: 'person', note: '人均为规划估算' }
  return { min: 0, max: spec.category === 'attraction' ? 80 : 30, unit: spec.category === 'attraction' ? 'ticket' : 'person', note: '价格或消费规则需出行前复核' }
}

function seededKnowledge(city: string, specs: CitySeedSpec[]): CityKnowledge {
  const items = specs.map((spec, index) => {
    const source = amapSource(`高德 POI：${city}${spec.name}`, `${city} ${spec.name}`)
    return {
      id: `${city}-seed-${index + 1}`,
      name: spec.name,
      category: spec.category,
      area: spec.area,
      tags: spec.tags,
      ...(spec.dietaryTags ? { dietaryTags: spec.dietaryTags } : {}),
      summary: spec.summary ?? `${spec.name}是${city}的${spec.category === 'food' || spec.category === 'restaurant' ? '本地餐饮候选' : '旅行候选地点'}，具体开放、价格和路线需出行前复核。`,
      coordinates: spec.coordinates,
      durationMinutes: spec.durationMinutes ?? (spec.category === 'attraction' ? 120 : 90),
      price: seedPrice(spec),
      source,
      verified: false,
    } satisfies CityKnowledgeItem
  })
  const hotelSource = amapSource(`高德 POI：${city}住宿区域查询`, `${city} 核心区 酒店`)
  return {
    city,
    status: 'curated',
    updatedAt: UPDATED_AT,
    intro: `${city}已建立知名景点、城市漫步、本地小吃和本地生活项目的结构化候选层。门票、营业时间、排队、价格和路线不作为静态事实，生成后仍需实时核验。`,
    sources: [hotelSource, ...items.map((item) => item.source)],
    hotelOptions: [
      { id: `${city}-budget-hotel`, name: `${city}核心区经济型酒店（待选）`, area: '核心区 / 地铁沿线', tier: 'budget', nightly: { min: 180, max: 320 }, summary: '优先保证交通和预算，具体门店按实时库存选择。', source: hotelSource, verified: false },
      { id: `${city}-comfort-hotel`, name: `${city}核心区舒适型酒店（待选）`, area: '核心区 / 地铁沿线', tier: 'comfort', nightly: { min: 360, max: 620 }, summary: '位置、舒适度和预算的中间档位。', source: hotelSource, verified: false },
      { id: `${city}-premium-hotel`, name: `${city}核心区高星酒店（待选）`, area: '核心区 / 景观片区', tier: 'premium', nightly: { min: 700, max: 1300 }, summary: '把更多预算留给位置、景观和服务。', source: hotelSource, verified: false },
    ],
    items,
  }
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

export const cityKnowledge: Record<string, CityKnowledge> = {
  上海: shanghaiKnowledge,
  长沙: changshaKnowledge,
  ...Object.fromEntries(Object.entries(citySeedSpecs).map(([city, specs]) => [city, seededKnowledge(city, specs)])),
}

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

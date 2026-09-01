import type { GuideCandidate, GuideClaim, GuidePlatform } from './guides'

type SocialSignalInput = {
  id: string
  city: string
  platform: GuidePlatform
  sourceUrl: string
  title: string
  author: string
  summary: string
  tags: string[]
  placeHints: string[]
  foodHints?: string[]
  localExperienceHints?: string[]
  dietaryTags?: string[]
  claims: GuideClaim[]
}

const signal = (input: SocialSignalInput): GuideCandidate => ({
  ...input,
  publishedAt: null,
  fetchedAt: '2026-08-31T00:00:00+08:00',
  likes: null,
  permission: 'user-provided',
})

/**
 * Derived, short-form signals from the research captures in
 * data/journey-images/social-research.json. The captures themselves stay in
 * the backend-only research store and are never used as user-facing covers.
 */
export const socialResearchGuides: GuideCandidate[] = [
  signal({
    id: 'social-research-hangzhou-xihu-cuyu',
    city: '杭州',
    platform: 'douyin',
    sourceUrl: 'https://www.douyin.com/video/7661130408604941283',
    title: '杭州西湖醋鱼：先看口味，再选老字号正餐',
    author: '嘉哥爱胡说',
    summary: '西湖醋鱼更适合作为杭州老城线中的一顿正餐安排；按同行口味选择酸甜程度，优先核对当日菜单和门店排队情况。',
    tags: ['本地美食', '西湖醋鱼', '老字号', '正餐'],
    placeHints: ['西湖', '河坊街', '楼外楼', '杭州酒家'],
    foodHints: ['西湖醋鱼'],
    dietaryTags: ['seafood', 'fish'],
    claims: [
      { type: 'food', text: '西湖醋鱼属于鱼类菜品，不吃鱼或对水产过敏时排除。', placeName: '西湖醋鱼', confidence: 0.86, verified: false },
      { type: 'tip', text: '把西湖醋鱼放在西湖或老城路线的正餐时段，先核对菜单和等位。', placeName: '西湖', confidence: 0.78, verified: false },
    ],
  }),
  signal({
    id: 'social-research-hangzhou-xihu-cuyu-xhs',
    city: '杭州',
    platform: 'xiaohongshu',
    sourceUrl: 'https://www.xiaohongshu.com/search_result/69f6ef60000000003601fd52?xsec_source=',
    title: '杭州西湖醋鱼点单与口味反馈',
    author: '戈多明儿准来',
    summary: '将西湖醋鱼和西湖边散步放在同一片区，点单前确认鱼类、酸甜口和人均预算，避免把它当作随手小吃。',
    tags: ['本地美食', '点单参考', '西湖醋鱼'],
    placeHints: ['西湖', '楼外楼', '知味观'],
    foodHints: ['西湖醋鱼'],
    dietaryTags: ['seafood', 'fish'],
    claims: [
      { type: 'food', text: '点单前先确认鱼类菜品和口味偏好，再决定是否安排。', placeName: '西湖醋鱼', confidence: 0.72, verified: false },
    ],
  }),
  signal({
    id: 'social-research-wuhan-liangdao-breakfast',
    city: '武汉',
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV1vTivYQEfL',
    title: '武汉粮道街过早：热干面、油饼包烧麦和三鲜豆皮',
    author: '逛吃小猪猪',
    summary: '武汉过早适合把粮道街、胭脂路一带作为同一条步行逛吃线，按摊位距离少量多样地吃，不必跨区折返。',
    tags: ['过早', '本地小吃', '粮道街', '市井烟火'],
    placeHints: ['粮道街过早', '胭脂路', '大成路早市'],
    foodHints: ['热干面', '油饼包烧麦', '三鲜豆皮', '面窝'],
    localExperienceHints: ['过早', '早市'],
    claims: [
      { type: 'food', text: '粮道街过早可少量组合热干面、油饼包烧麦、三鲜豆皮和面窝。', placeName: '粮道街过早', confidence: 0.84, verified: false },
      { type: 'route', text: '早饭集中在粮道街、胭脂路一带安排，减少跨区移动。', placeName: '粮道街过早', confidence: 0.8, verified: false },
    ],
  }),
  signal({
    id: 'social-research-kunming-zhuanxin-market',
    city: '昆明',
    platform: 'douyin',
    sourceUrl: 'https://www.douyin.com/video/7663072741298861011',
    title: '昆明篆新农贸市场：本地人逛市场的预算线索',
    author: '哎么英仔',
    summary: '篆新农贸市场适合早上集中逛吃，先看现制小吃和熟食摊，再按预算补买水果、鲜花或云南食材；人多时按主通道顺行。',
    tags: ['农贸市场', '本地小吃', '早市', '昆明生活'],
    placeHints: ['篆新农贸市场'],
    foodHints: ['云南小吃', '米线', '烧饵块', '鲜花饼'],
    localExperienceHints: ['逛菜市场', '早市', '本地人生活'],
    claims: [
      { type: 'place', text: '篆新农贸市场适合作为昆明本地生活和小吃集中体验点。', placeName: '篆新农贸市场', confidence: 0.82, verified: false },
      { type: 'food', text: '市场内优先按现制小吃、熟食和当季食材顺序选择，预算可分段控制。', placeName: '篆新农贸市场', confidence: 0.76, verified: false },
    ],
  }),
  signal({
    id: 'social-research-kunming-zhuanxin-market-xhs',
    city: '昆明',
    platform: 'xiaohongshu',
    sourceUrl: 'https://www.xiaohongshu.com/search_result/6a58b04c0000000006010ea5?xsec_source=',
    title: '昆明篆新农贸市场小吃红黑榜线索',
    author: '哎么英仔',
    summary: '把篆新市场当作一站式早午餐，先解决主食，再挑一两样小吃；具体摊位和营业状态仍按当天现场确认。',
    tags: ['篆新农贸市场', '小吃', '早午餐', '预算友好'],
    placeHints: ['篆新农贸市场'],
    foodHints: ['云南小吃', '米线', '破酥包', '烧饵块'],
    localExperienceHints: ['市场逛吃', '早午餐'],
    claims: [
      { type: 'tip', text: '篆新市场适合先吃主食、再补小吃，避免一次点太多。', placeName: '篆新农贸市场', confidence: 0.7, verified: false },
    ],
  }),
  signal({
    id: 'social-research-harbin-red-sausage',
    city: '哈尔滨',
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV1TP411J75A',
    title: '哈尔滨红肠怎么选：老字号对比与伴手礼线索',
    author: '孙小溅爱吃肉',
    summary: '哈尔滨红肠适合放进中央大街—圣索菲亚一带的伴手礼时段，先比较老字号口味和包装，再按是否现吃或携带选择。',
    tags: ['哈尔滨红肠', '伴手礼', '道里老城', '本地味道'],
    placeHints: ['中央大街', '圣索菲亚教堂', '红专街早市'],
    foodHints: ['哈尔滨红肠'],
    localExperienceHints: ['伴手礼采购', '早市'],
    dietaryTags: ['meat', 'pork'],
    claims: [
      { type: 'food', text: '哈尔滨红肠是肉类食品，不吃肉或不吃猪肉时排除，并查看包装配料。', placeName: '哈尔滨红肠', confidence: 0.9, verified: false },
      { type: 'tip', text: '购买红肠时区分现吃和携带需求，比较口味、规格和保存方式。', placeName: '中央大街', confidence: 0.74, verified: false },
    ],
  }),
  signal({
    id: 'social-research-guangzhou-morning-tea',
    city: '广州',
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV1Vt42187ET',
    title: '广州凌晨早茶：老城区点心时间线',
    author: '不酸酸的酸',
    summary: '广州早茶要按开市时间安排，沙面、上下九和永庆坊可以顺路组合；先确认茶楼营业，再选择点心和等位时长。',
    tags: ['早茶', '点心', '老城逛吃', '广州本地生活'],
    placeHints: ['沙面岛', '上下九', '永庆坊'],
    foodHints: ['虾饺', '烧卖', '肠粉', '双皮奶'],
    localExperienceHints: ['早茶', '老城区生活'],
    claims: [
      { type: 'route', text: '早茶放在广州老城线的上午，饭后再接沙面或永庆坊散步。', placeName: '沙面岛', confidence: 0.79, verified: false },
      { type: 'tip', text: '先确认茶楼开市和等位时间，再决定点心数量。', placeName: '上下九', confidence: 0.75, verified: false },
    ],
  }),
  signal({
    id: 'social-research-nanjing-niushou-mountain',
    city: '南京',
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV17V4czmE3V',
    title: '南京牛首山半日攻略：重点看佛顶宫与山体空间',
    author: '陆地小狗',
    summary: '牛首山更适合单独安排半天，先看佛顶宫和佛顶塔，再根据体力选择景区接驳与步行段，不和南京市中心景点来回穿插。',
    tags: ['牛首山', '远郊半日', '佛顶宫', '南京近郊'],
    placeHints: ['牛首山文化旅游区', '佛顶宫', '佛顶塔'],
    localExperienceHints: ['远郊半日', '景区接驳'],
    claims: [
      { type: 'place', text: '牛首山核心看佛顶宫、佛顶塔和山体景观，适合独立占用半天。', placeName: '牛首山文化旅游区', confidence: 0.82, verified: false },
      { type: 'route', text: '牛首山与南京市中心景点分日安排，减少往返。', placeName: '牛首山文化旅游区', confidence: 0.8, verified: false },
    ],
  }),
  signal({
    id: 'social-research-chengdu-dujiangyan',
    city: '成都',
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV1s9WszdExm',
    title: '成都到都江堰：远郊一日线的顺序线索',
    author: '四川旅游小慧',
    summary: '都江堰适合从成都单独安排远郊日，先看水利工程核心区，再接灌县古城和钟书阁等周边点位，避免与市中心行程交叉。',
    tags: ['都江堰', '远郊一日', '水利工程', '成都周边'],
    placeHints: ['都江堰景区', '灌县古城', '钟书阁都江堰店'],
    localExperienceHints: ['远郊一日', '古城散步'],
    claims: [
      { type: 'place', text: '都江堰核心看水利工程，再按体力衔接灌县古城。', placeName: '都江堰景区', confidence: 0.83, verified: false },
      { type: 'route', text: '都江堰单独占一天更顺，避免和成都中心景点来回折返。', placeName: '都江堰景区', confidence: 0.8, verified: false },
    ],
  }),
]

export const socialResearchGuideIds = new Set(socialResearchGuides.map((guide) => guide.id))

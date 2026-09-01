import type { GuideCandidate, GuideClaim, GuidePlatform } from './guides'

const fetchedAt = '2026-08-30T12:30:00.000Z'
const douyinSearchUrl = (query: string) => `https://www.douyin.com/search/${encodeURIComponent(query)}?type=general`

function signal(
  city: string,
  platform: GuidePlatform,
  sourceUrl: string,
  title: string,
  author: string,
  tags: string[],
  placeHints: string[],
  foodHints: string[],
  localExperienceHints: string[],
  hotelHints: string[] = [],
): GuideCandidate {
  const claims: GuideClaim[] = [
    ...(placeHints.length > 0 ? [{ type: 'place' as const, text: `社区攻略提到：${placeHints.join('、')}`, placeName: placeHints[0], confidence: 0.62, verified: false }] : []),
    ...(foodHints.length > 0 ? [{ type: 'food' as const, text: `社区攻略提到的本地吃法：${foodHints.join('、')}`, confidence: 0.58, verified: false }] : []),
    ...(localExperienceHints.length > 0 ? [{ type: 'activity' as const, text: `社区攻略提到的本地生活项目：${localExperienceHints.join('、')}`, confidence: 0.58, verified: false }] : []),
  ]
  return {
    id: `${platform}-${city}-regional-signal`,
    city,
    platform,
    sourceUrl,
    title,
    author,
    publishedAt: null,
    fetchedAt,
    likes: null,
    summary: `${city}社区内容线索：${[...placeHints, ...foodHints, ...localExperienceHints, ...hotelHints].join('、')}。仅作体验排序参考，路线和预约规则会随日期变化。`,
    tags,
    placeHints,
    foodHints,
    localExperienceHints,
    hotelHints,
    hotelNames: [],
    dietaryTags: [],
    claims,
    permission: 'unknown',
  }
}

/**
 * Compact, source-preserving supplement from the latest alternating Douyin /
 * Bilibili reads. It stores derived cues and links, not copied post bodies or
 * platform screenshots.
 */
export const regionalCommunitySignals: GuideCandidate[] = [
  signal('康定', 'douyin', douyinSearchUrl('康定 攻略 本地人 美食'), '川西避暑攻略之：康定，第一次来可以直接抄作业', '阿文旅吃', ['逛吃', '本地人推荐', '住宿'], ['溜溜城', '康定情歌广场', '新都桥', '木格措'], ['牦牛肉菌汤锅', '藏餐', '青稞饼', '牦牛酸奶'], ['老城晨走', '本地小店', '高原咖啡']),
  signal('稻城亚丁', 'bilibili', 'https://www.bilibili.com/video/BV18h41167hB', '稻城亚丁3天2夜旅行攻略', '才大喜', ['交通', '经典', '高原'], ['稻城亚丁景区', '洛绒牛场', '牛奶海'], ['藏餐', '青稞饼'], ['香格里拉镇慢走', '高原适应']),
  signal('九寨沟', 'bilibili', 'https://www.bilibili.com/video/BV1Snnxz4EM1', '夏日双人游｜九寨沟+四姑娘山｜不自驾也能玩川西', '夹夹夹夹门', ['路线', '不自驾', '自然'], ['九寨沟风景名胜区', '五花海', '诺日朗瀑布'], ['牦牛肉汤锅'], ['沟口藏寨', '景区接驳']),
  signal('大理', 'douyin', douyinSearchUrl('大理 古城 3天 2夜 本地人'), '本地人总结的大理古城美食攻略', '随时有人陪我出去玩', ['逛吃', '本地人推荐', '3天2夜'], ['大理古城', '洱海', '龙龛码头', '才村'], ['火烧生皮', '石板烧', '三道茶'], ['古城晨走', '洱海骑行', '本地市场']),
  signal('丽江', 'bilibili', 'https://www.bilibili.com/video/BV1xS421o7bm', '云南5日游｜丽江大理昆明，超详细旅游攻略', '码语者和杰妮', ['路线', '5日', '云南'], ['丽江古城', '玉龙雪山', '蓝月谷', '束河古镇'], ['腊排骨火锅', '鸡豆凉粉', '丽江粑粑'], ['古城慢走', '忠义市场']),
  signal('香格里拉', 'bilibili', 'https://www.bilibili.com/video/BV1No4y1n717', '云南北线旅游攻略（昆明-大理-丽江-香格里拉）', '旅行的鸵鸟', ['路线', '高原', '云南北线'], ['松赞林寺', '独克宗古城', '纳帕海'], ['牦牛火锅', '酥油茶'], ['转经筒', '古城慢走']),
  signal('西双版纳', 'douyin', douyinSearchUrl('西双版纳 旅行 美食 本地人'), '本地人带路的极限两天逛吃云南', '爱吃甜的小颖', ['逛吃', '本地人推荐', '夜市'], ['告庄西双景', '曼听公园', '星光夜市'], ['傣味手抓饭', '舂鸡脚', '傣味烧烤'], ['傣族早市', '告庄夜市', '水果市场']),
  signal('腾冲', 'bilibili', 'https://www.bilibili.com/video/BV1t8PUeHE43', '云南-腾冲旅游vlog：热海大滚锅、司莫拉佤族村、和顺古镇', '幽柠檬', ['慢旅行', '古镇', '自然'], ['和顺古镇', '热海景区', '火山地热国家地质公园'], ['大救驾', '稀豆粉', '土锅子'], ['和顺早市', '泡温泉', '老城慢走']),
  signal('沈阳', 'bilibili', 'https://www.bilibili.com/video/BV1H4421w7BG', '北京 长春 哈尔滨 漠河 延吉 沈阳之旅', '陈年老冰', ['东北', '城市线', '交通'], ['沈阳故宫', '张氏帅府', '中街'], ['鸡架', '锅包肉', '东北烧烤'], ['西塔街早市', '东北洗浴', '老北市夜逛']),
  signal('大连', 'bilibili', 'https://www.bilibili.com/video/BV1UA2mYuEf4', '坐36个小时的绿皮车，从大连纵贯东北到漠河', 'CR小小瓦罐', ['东北', '火车', '海滨'], ['星海广场', '滨海路', '中山广场'], ['海菜包子', '鲅鱼饺子', '海鲜烧烤'], ['东港晨走', '渔人码头', '海边散步']),
  signal('长春', 'bilibili', 'https://www.bilibili.com/video/BV1Nu41187gz', '骑行去漠河，在长春打卡这有山和伪满皇宫', '船长觅食记', ['电影城市', '东北', '骑行'], ['伪满皇宫博物院', '这有山', '长影旧址博物馆'], ['长春冷面', '锅包肉', '鸡架'], ['净月潭骑行', '桂林路逛吃']),
  signal('延吉', 'bilibili', 'https://www.bilibili.com/video/BV1zhe4z1Eif', '夏天连玩东北五个地方：哈尔滨、漠河、长春、长白山、延吉', 'Yeah0_', ['东北', '多城路线', '美食'], ['延边大学', '西市场', '长白山'], ['延吉冷面', '石锅拌饭', '米肠'], ['水上市场早市', '朝鲜族民俗体验']),
  signal('漠河', 'bilibili', 'https://www.bilibili.com/video/BV1Mc411D7D4', '漠河龙江第一湾，乌苏里浅滩旅游攻略', '孟游全世界', ['极北', '自然', '自驾'], ['北极村', '龙江第一湾', '乌苏里浅滩'], ['东北铁锅炖', '蓝莓', '冻梨'], ['找北', '北红村炕体验', '边境线']),
  signal('温州', 'bilibili', 'https://www.bilibili.com/video/BV1DaKz6LEM6', '温州台州三日深度游：山水古城美食全包', '跟着小雨去旅行', ['浙南', '古城', '山水'], ['江心屿', '五马街', '楠溪江', '洞头景区'], ['温州鱼丸', '瘦肉丸', '灯盏糕'], ['五马街早茶', '南塘夜景', '老城慢走']),
  signal('台州', 'bilibili', 'https://www.bilibili.com/video/BV1ZmCiBMEG5', '台州三大5A级景点：国清寺、神仙居、台州府城', '流水浮三生_', ['浙南', '5A级景点', '山水'], ['神仙居', '国清寺', '台州府城', '紫阳街'], ['台州糊', '临海麦虾', '姜汤面'], ['紫阳街早走', '石塘渔村']),
  signal('丽水', 'bilibili', 'https://www.bilibili.com/video/BV118Hpz2EU9', '丽水十大特产终极指南：旅游必买清单', '旅游说', ['浙南', '特产', '山水'], ['古堰画乡', '仙都景区', '云和梯田'], ['缙云烧饼', '黄粿', '竹筒饭'], ['松阳老街', '古村慢走', '摄影采风']),
  signal('乌鲁木齐', 'douyin', douyinSearchUrl('乌鲁木齐 3天 旅游 美食 攻略'), '乌鲁木齐3天旅游美食全攻略', '宥宥不会喝酒', ['逛吃', '本地人推荐', '3天'], ['国际大巴扎', '新疆博物馆', '红山公园'], ['烤羊肉串', '大盘鸡', '馕', '新疆拌面'], ['二道桥巴扎', '干果市场', '烤馕房']),
  signal('喀什', 'douyin', douyinSearchUrl('喀什 旅游 美食 攻略'), '南疆美味在喀什', '老王不吃糖', ['南疆', '逛吃', '古城'], ['喀什古城', '喀什东巴扎', '艾提尕尔清真寺'], ['烤包子', '缸子肉', '手抓饭'], ['老城巷道晨走', '百年茶馆', '夜市']),
  signal('拉萨', 'douyin', douyinSearchUrl('拉萨 攻略 美食 本地人'), '拉萨8家老牌美食，本地人私藏不踩雷', '圆梦西藏旅游', ['高原', '本地人推荐', '美食'], ['布达拉宫', '大昭寺', '八廓街'], ['藏面', '甜茶', '酥油茶', '藏式土火锅'], ['八廓街转经', '甜茶馆', '色拉寺辩经']),
  signal('林芝', 'douyin', douyinSearchUrl('林芝 市区 旅行 美食 攻略'), '雪域江南—林芝逛吃攻略', '大圣的餐饮日记', ['高原', '逛吃', '市区慢游'], ['八一镇', '尼洋河', '鲁朗林海'], ['鲁朗石锅鸡', '牦牛肉', '松茸'], ['八一镇夜市', '农贸市场', '尼洋河晨走']),
  signal('南京', 'douyin', 'https://www.douyin.com/video/7663480438372177743', '南京博物院本地人不绕路动线', '食味小日子', ['博物馆', '不绕路', '本地人推荐'], ['南京博物院', '历史馆', '民国馆'], ['鸭血粉丝汤', '牛肉锅贴'], ['博物馆分馆慢看', '城东文化线']),
]

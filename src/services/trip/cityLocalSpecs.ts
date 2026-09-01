import type { KnowledgePrice, KnowledgeSource } from './cityKnowledge'
import type { CityAdditionalSpec } from './cityKnowledge.expanded'

const CHECKED_AT = '2026-08-31'

const centers: Record<string, [number, number]> = {
  上海: [121.47, 31.23], 杭州: [120.16, 30.25], 苏州: [120.62, 31.32], 南京: [118.79, 32.04],
  成都: [104.07, 30.66], 厦门: [118.08, 24.48], 北京: [116.4, 39.9], 广州: [113.26, 23.13],
  重庆: [106.55, 29.56], 西安: [108.94, 34.34], 深圳: [114.06, 22.54], 长沙: [112.97, 28.19],
  青岛: [120.38, 36.07], 武汉: [114.3, 30.59], 昆明: [102.83, 24.88], 三亚: [109.51, 18.25],
  桂林: [110.3, 25.27], 哈尔滨: [126.64, 45.76], 贵阳: [106.71, 26.57], 张家界: [110.48, 29.13],
  康定: [101.96, 30.05], 稻城亚丁: [100.3, 29.04], 九寨沟: [103.92, 33.26], 大理: [100.23, 25.59],
  丽江: [100.23, 26.87], 香格里拉: [99.71, 27.83], 西双版纳: [100.8, 22.01], 腾冲: [98.49, 25.02],
  沈阳: [123.43, 41.8], 大连: [121.61, 38.91], 长春: [125.32, 43.82], 延吉: [129.51, 42.9],
  漠河: [122.54, 52.97], 温州: [120.7, 28.0], 台州: [121.42, 28.66], 丽水: [119.92, 28.47],
  乌鲁木齐: [87.62, 43.83], 喀什: [75.99, 39.47], 拉萨: [91.14, 29.65], 林芝: [94.36, 29.65],
}

const price = (min: number, max: number): KnowledgePrice => ({
  min,
  max,
  unit: 'person',
  note: '价格为公开体验线索的区间估算，按当天菜单核验',
})

const point = (city: string, index = 0): [number, number] => {
  const [longitude, latitude] = centers[city] ?? [0, 0]
  return [longitude + (index % 3) * 0.004, latitude + (index % 2) * 0.003]
}

const communitySource = (name: string, url: string): KnowledgeSource => ({
  label: `走走知识库公开地点线索：${name}`,
  url,
  kind: 'community',
  checkedAt: CHECKED_AT,
})

const amapSource = (name: string, url: string): KnowledgeSource => ({
  label: `高德 POI：${name}`,
  url,
  kind: 'amap',
  checkedAt: CHECKED_AT,
})

type ConcretePlaceDetails = Partial<Pick<CityAdditionalSpec, 'address' | 'menuHighlights' | 'searchKeyword' | 'coordinates' | 'price' | 'source'>>

const concretePlaceDetails: Record<string, ConcretePlaceDetails> = {
  '上海:味香斋': {
    address: '上海市黄浦区雁荡路14号',
    menuHighlights: ['麻酱面', '小牛汤', '辣肉酱', '排骨年糕'],
    searchKeyword: '上海 味香斋 雁荡路14号',
    source: { label: '公开地点核验：味香斋（雁荡路）', url: 'https://guide.michelin.com/sg/zh_CN/shanghai-municipality/shanghai/restaurant/wei-xiang-zhai', kind: 'official', checkedAt: CHECKED_AT },
  },
  '上海:大壶春': {
    address: '上海市黄浦区四川中路136号',
    menuHighlights: ['生煎', '小云吞', '排骨年糕', '咖喱牛肉汤'],
    searchKeyword: '上海 大壶春 四川中路136号',
    source: { label: '公开地点核验：大壶春（四川中路）', url: 'https://guide.michelin.com/sg/zh_CN/shanghai-municipality/shanghai/restaurant/da-hu-chun-middle-sichuan-road', kind: 'official', checkedAt: CHECKED_AT },
  },
  '杭州:奎元馆': {
    address: '浙江省杭州市上城区解放路154号',
    menuHighlights: ['片儿川', '虾爆鳝面', '猪肝面'],
    searchKeyword: '杭州 奎元馆 解放路154号',
    source: { label: '公开地点核验：奎元馆（解放路）', url: 'https://zhlzh.mofcom.gov.cn/news/entp_view/5838', kind: 'official', checkedAt: CHECKED_AT },
  },
  '苏州:裕兴记': {
    address: '江苏省苏州市姑苏区平江街道西北街11号',
    menuHighlights: ['三虾面', '苏式小笼', '排骨面', '猪肝面'],
    searchKeyword: '苏州 裕兴记 三虾面 西北街11号',
    source: { label: '公开地点核验：裕兴记·三虾面（西北街总店）', url: 'https://gs.ctrip.com/html5/you/foods/fooddetail/11/5125945.html', kind: 'official', checkedAt: CHECKED_AT },
  },
  '南京:叶新小吃': {
    address: '南京市秦淮区金粟庵路5-8号（2号门）',
    menuHighlights: ['小吃', '面点'],
    searchKeyword: '南京 叶新小吃店 来凤小区总店 金粟庵路5-8号',
    coordinates: [118.774190, 32.019889],
    source: { label: '高德 POI：叶新小吃店（来凤小区总店）', url: 'https://www.amap.com/place/B0FFF90OUQ', kind: 'amap', checkedAt: CHECKED_AT },
  },
  '南京:江南春面馆': {
    address: '南京市应天大街387-28号临',
    menuHighlights: ['三鲜干挑面', '皮肚面', '腰子汤'],
    searchKeyword: '南京 泰顺江南春面馆 应天大街387-28号',
    source: { label: '公开地点核验：泰顺江南春面馆', url: 'https://gs.ctrip.com/html5/you/foods/Nanjing9/5095315.html', kind: 'official', checkedAt: CHECKED_AT },
  },
  '厦门:吴再添小吃店': {
    address: '福建省厦门市美湖路25号一层西侧',
    menuHighlights: ['烧肉粽', '沙茶面', '炸五香', '肉羹汤'],
    searchKeyword: '厦门 吴再添小吃店 美湖路25号',
    source: { label: '公开地点核验：吴再添小吃店', url: 'https://gs.ctrip.com/html5/you/foods/fooddetail/21/319801.html', kind: 'official', checkedAt: CHECKED_AT },
  },
  '厦门:小眼镜大排档': {
    address: '福建省厦门市虎园路1号附近（万佳东方店）',
    menuHighlights: ['清蒸鱿鱼', '杂鱼酱油水', '厦门炒面线', '白灼虾', '炒花蛤', '海蛎煎'],
    searchKeyword: '厦门 小眼镜大排档 万佳东方店 虎园路1号',
    source: { label: '公开地点核验：小眼镜大排档（万佳东方店）', url: 'http://m.dianping.com/shop/5379532?msource=applemaps', kind: 'official', checkedAt: CHECKED_AT },
  },
  '北京:尹三豆汁（前门旗舰店）': {
    address: '北京市西城区前门大栅栏街1号一楼',
    menuHighlights: ['豆汁', '焦圈', '面茶', '咸菜丝', '糖火烧', '老北京炸酱面', '手工酸奶'],
    searchKeyword: '北京 尹三豆汁 前门旗舰店 大栅栏街1号',
    coordinates: [116.397402, 39.896167],
    price: { min: 15, max: 33, unit: 'person', note: '不同门店与套餐公开价格线索；以当天菜单为准' },
    source: { label: '高德 POI：尹三豆汁（前门旗舰店）', url: 'https://www.amap.com/place/B0KB7CI6W5', kind: 'amap', checkedAt: CHECKED_AT },
  },
  '昆明:爱尚菌·云南真野生菌火锅（翠湖公园店）': {
    address: '昆明市五华区翠湖南路翠湖公园南门云咖啡对面',
    menuHighlights: ['真野生菌拼盘', '云南高山散养走地鸡茶花鸡锅底', '文山甄选牛胸叉', '德和午餐肉', '青峦彩蔬拼', '野菜糍粑', '滇味三色面', '自助蘸水'],
    searchKeyword: '昆明 爱尚菌 云南真野生菌火锅 翠湖公园店',
    source: { label: '公开地点核验：爱尚菌·云南真野生菌火锅（翠湖公园店）', url: 'https://www.xiaohongshu.com/search_result/6a8714af000000003a02e2b1', kind: 'community', checkedAt: CHECKED_AT },
  },
}

const restaurant = (
  city: string,
  name: string,
  area: string,
  signature: string,
  dietaryTags: string[] = [],
  priceRange: KnowledgePrice = price(30, 100),
  source?: KnowledgeSource,
  index = 0,
): CityAdditionalSpec => ({
  name,
  category: 'restaurant',
  area: area.replaceAll('社区', '片区'),
  tags: ['本地美食', '本地餐馆', '片区就近吃'],
  summary: `${name}是${city}${area.replaceAll('社区', '片区')}可检索的具体餐饮地点，常见看点是${signature.replaceAll('社区', '街区').replaceAll('苍蝇馆子', '家常小店')}；招牌和配料按门店菜单选择，热门时段预留排队时间。`,
  coordinates: point(city, index),
  venueName: name,
  searchKeyword: `${city} ${name}`,
  menuHighlights: signature.split(/[、，,和及/]+/).map((item) => item.trim()).filter(Boolean),
  durationMinutes: 75,
  price: priceRange,
  dietaryTags,
  ...(source ? { source } : {}),
  ...(concretePlaceDetails[`${city}:${name}`] ?? {}),
})

const localProject = (
  city: string,
  name: string,
  area: string,
  summary: string,
  tags: string[] = ['本地人项目', '本地生活'],
  source?: KnowledgeSource,
  index = 0,
): CityAdditionalSpec => ({
  name,
  category: 'activity',
  area: area.replaceAll('社区', '片区'),
  tags,
  summary: `${summary.replaceAll('社区', '街区').replaceAll('苍蝇馆子', '家常小店').replaceAll('本地生活', '当地日常')}具体开放、客流和消费按当天公开信息确认。`,
  coordinates: point(city, index),
  venueName: name,
  searchKeyword: `${city} ${name.replace(/(?:逛吃|早走|慢逛|夜逛|晨走|体验)$/g, '')}`,
  durationMinutes: 90,
  price: { min: 0, max: 50, unit: 'person', note: '公共空间或体验消费按当天情况确认' },
  ...(source ? { source } : {}),
})

const xhsShanghai = 'https://www.xiaohongshu.com/search_result/69918b9e0000000015033f80'
const bilibili = {
  芳明小吃: 'https://www.bilibili.com/video/BV1XjSyYCEBb',
  苏州本地味: 'https://www.bilibili.com/video/BV1pU8J6TELq',
  厦门吴再添: 'https://www.bilibili.com/video/BV1Dt411e7db',
  厦门小眼镜: 'https://www.bilibili.com/video/BV1i27tziE3F',
  广州西华路: 'https://www.bilibili.com/video/BV1Lz8X6HE6Z',
  重庆胖子小吃: 'https://www.bilibili.com/video/BV1pp4y1r7ng',
  长沙苍蝇馆子: 'https://www.bilibili.com/video/BV1ZQ4y1F7Np',
  昆明芳香小吃: 'https://www.bilibili.com/video/BV11P4y1g7WT',
  昆明每天饭店: 'https://www.bilibili.com/video/BV1Bm411d7HS',
  哈尔滨六顺园: 'https://www.bilibili.com/video/BV1Gp4y1R7TF',
  长春樱花小吃: 'https://www.bilibili.com/video/BV1oy411e7yq',
  沈阳马家小吃部: 'https://www.bilibili.com/video/BV1rT421e7z7',
  台州炎森饭店: 'https://www.bilibili.com/video/BV16rv8BzEGB',
  丽水老陶: 'https://www.bilibili.com/video/BV1Y3411n7Do',
  丽水云禾: 'https://www.bilibili.com/video/BV1NnMEzcEpu',
  腾冲寸大官: 'https://www.bilibili.com/video/BV1Bs4y1Q7ty',
  稻城扎西德勒: 'https://www.bilibili.com/video/BV18Pp8zrEHj',
  九寨藏家小菜: 'https://www.bilibili.com/video/BV1Sh411J7Qq',
  西双版纳多哥水: 'https://www.bilibili.com/video/BV1go4y1d74Z',
  康定美食地图: 'https://www.bilibili.com/video/BV1odyUB5ERa',
}

/**
 * Named food venues and concrete local-life projects. Names are searchable
 * candidates; the planner keeps the source link and never treats a single
 * community mention as a live rating or a guarantee of current operation.
 */
export const cityLocalSpecs: Record<string, CityAdditionalSpec[]> = {
  上海: [
    restaurant('上海', '味香斋', '黄浦老城', '本帮面和老城小吃', ['meat', 'pork'], price(20, 55), communitySource('味香斋', xhsShanghai)),
    restaurant('上海', '大壶春', '黄浦 / 静安', '生煎和传统点心', ['meat', 'pork'], price(20, 60), communitySource('大壶春', xhsShanghai), 1),
    localProject('上海', '昌里路夜市逛吃', '浦东上南', '适合安排在浦东片区的傍晚，边走边看社区餐饮，不与外滩路线来回折返。', ['本地人项目', '夜市', '市井烟火'], undefined, 2),
  ],
  杭州: [
    restaurant('杭州', '奎元馆', '湖滨 / 老城', '片儿川和杭州面食', ['meat', 'pork'], price(20, 60), undefined),
    restaurant('杭州', '芳明小吃', '滨江社区', '社区小吃和苍蝇小馆体验', ['meat', 'spicy'], price(20, 60), communitySource('芳明小吃', bilibili.芳明小吃), 1),
    localProject('杭州', '胜利河美食街夜逛', '拱墅区', '把运河夜景和本地餐饮放在一条线，适合替换拥挤的纯打卡路线。', ['本地人项目', '夜逛', '逛吃'], undefined, 2),
  ],
  苏州: [
    restaurant('苏州', '陆振兴', '姑苏老城', '苏式面和浇头', ['meat', 'seafood'], price(20, 65), communitySource('陆振兴', bilibili.苏州本地味)),
    restaurant('苏州', '裕兴记', '观前街 / 姑苏', '苏式面和时令浇头', ['meat', 'seafood'], price(25, 80), communitySource('裕兴记', bilibili.苏州本地味), 1),
    localProject('苏州', '双塔市集逛吃', '姑苏区', '菜市场、小吃和居民区步行可以放在同一段，适合看苏州日常烟火。', ['本地人项目', '菜市场', '逛吃'], undefined, 2),
  ],
  南京: [
    restaurant('南京', '江南春面馆', '鼓楼 / 老城', '本地面食和社区早餐', ['meat', 'pork'], price(18, 50)),
    restaurant('南京', '叶新小吃', '秦淮老城', '小吃、面点和街坊日常', ['meat', 'pork'], price(15, 50), undefined, 1),
    localProject('南京', '南湖茶南菜市场逛吃', '建邺区', '把南湖茶南和社区餐饮作为一条半日线，放在市中心路线之外的同一片区。', ['本地人项目', '菜市场', '逛吃'], undefined, 2),
  ],
  成都: [
    restaurant('成都', '明婷饭店', '玉林 / 市中心南线', '家常川菜和市井烟火', ['spicy', 'meat'], price(45, 110)),
    restaurant('成都', '甘食记肥肠粉', '春熙路 / 社区店', '肥肠粉和成都早餐', ['spicy', 'meat', 'pork'], price(15, 45), undefined, 1),
    localProject('成都', '鹤鸣茶社喝盖碗茶', '人民公园', '把喝茶、掏耳朵和公园慢坐作为成都本地生活节点，给行程留一段空白。', ['本地人项目', '茶馆', '休息'], undefined, 2),
  ],
  厦门: [
    restaurant('厦门', '吴再添小吃店', '大同路 / 老城', '闽南小吃和传统汤食', ['seafood', 'meat', 'peanut'], price(15, 50), communitySource('吴再添小吃店', bilibili.厦门吴再添)),
    restaurant('厦门', '小眼镜大排档', '开元路 / 老城', '闽南海鲜排档', ['seafood'], price(80, 180), communitySource('小眼镜大排档', bilibili.厦门小眼镜), 1),
    localProject('厦门', '第八市场早走', '思明老城', '早餐、买菜和小吃放在同一条老城步行线，海鲜过敏者可以只逛市场并选择非海鲜小吃。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  北京: [
    restaurant('北京', '姚记炒肝', '鼓楼 / 胡同片区', '炒肝和老北京早餐', ['meat', 'pork'], price(20, 55)),
    restaurant('北京', '方砖厂69号炸酱面', '南锣鼓巷 / 胡同', '炸酱面和胡同餐饮', ['meat', 'pork'], price(25, 65), undefined, 1),
    restaurant('北京', '尹三豆汁（前门旗舰店）', '前门大栅栏', '豆汁、焦圈、面茶和咸菜丝', [], price(15, 33), undefined, 2),
    localProject('北京', '潘家园旧货市场逛早市', '朝阳区', '适合周末早晨慢逛旧货与摊位，和故宫老城路线分开安排。', ['本地人项目', '早市', '市集'], undefined, 2),
  ],
  广州: [
    restaurant('广州', '芳记小食店', '西华路 / 荔湾', '肠粉、油条和老广早餐', ['meat', 'pork'], price(15, 45), communitySource('芳记小食店', bilibili.广州西华路)),
    restaurant('广州', '富记鱼蛋粉', '西华路 / 荔湾', '鱼蛋粉和社区小吃', ['seafood'], price(18, 55), communitySource('富记鱼蛋粉', bilibili.广州西华路), 1),
    localProject('广州', '西华路早走', '荔湾老城', '把早茶、骑楼和社区菜市场放在一条西关路线里，适合上午完成。', ['本地人项目', '早茶', '城市漫步'], undefined, 2),
  ],
  重庆: [
    restaurant('重庆', '胖子小吃', '沙坪坝', '麻辣烫和学生街小吃', ['spicy', 'meat'], price(20, 60), communitySource('胖子小吃', bilibili.重庆胖子小吃)),
    restaurant('重庆', '梯坎面', '渝中 / 山城片区', '重庆小面和坡坎烟火', ['spicy', 'meat'], price(12, 35), undefined, 1),
    localProject('重庆', '野水沟菜市场逛吃', '渝中老城', '适合上午看菜市场和老居民区，放在解放碑同侧路线，不与南岸跨江混排。', ['本地人项目', '菜市场', '市井烟火'], undefined, 2),
  ],
  西安: [
    restaurant('西安', '秦豫肉夹馍', '碑林 / 老城', '腊汁肉夹馍', ['meat', 'pork'], price(15, 40)),
    restaurant('西安', '子午路张记肉夹馍', '小寨 / 城南', '肉夹馍和陕西面食', ['meat', 'pork'], price(15, 45), undefined, 1),
    localProject('西安', '洒金桥早走', '莲湖老城', '早餐、清真小吃和老街慢走安排在同一段，避开把回民街和城南来回穿插。', ['本地人项目', '早市', '老街'], undefined, 2),
  ],
  深圳: [
    restaurant('深圳', '八合里海记牛肉店', '罗湖 / 东门', '潮汕牛肉火锅', ['meat'], price(80, 180)),
    restaurant('深圳', '陈鹏鹏卤鹅饭店', '福田 / 罗湖', '潮汕卤鹅和熟食', ['meat'], price(45, 120), undefined, 1),
    localProject('深圳', '梅林农批市场早走', '福田区', '用农批市场和周边社区早餐感受深圳本地生活，适合替换纯商圈打卡。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  长沙: [
    restaurant('长沙', '四方坪三十栋饭店', '四方坪', '家常湘菜和苍蝇馆子体验', ['spicy', 'meat'], price(45, 110), communitySource('四方坪三十栋饭店', bilibili.长沙苍蝇馆子)),
    restaurant('长沙', '秦娭毑皮蛋肉丸', '开福 / 老城', '皮蛋肉丸等本地家常菜', ['spicy', 'meat', 'pork'], price(35, 90), communitySource('秦娭毑皮蛋肉丸', bilibili.长沙苍蝇馆子), 1),
    localProject('长沙', '四方坪早市逛吃', '四方坪', '早市和社区早餐安排在同一片区，之后接北城路线，减少五一广场与远郊折返。', ['本地人项目', '早市', '逛吃'], undefined, 2),
  ],
  青岛: [
    restaurant('青岛', '万和春排骨米饭', '市南 / 台东', '排骨米饭和青岛家常口味', ['meat', 'pork'], price(25, 60)),
    restaurant('青岛', '船歌鱼水饺', '市南沿海', '鲅鱼水饺和海鲜水饺', ['seafood'], price(45, 110), undefined, 1),
    localProject('青岛', '台东早市逛吃', '市北区', '把早餐和社区市场安排在上午，下午再去八大关或沿海线，避免跨区重复。', ['本地人项目', '早市', '市井烟火'], undefined, 2),
  ],
  武汉: [
    restaurant('武汉', '蔡林记热干面', '江汉路 / 老城', '热干面和武汉过早', ['meat', 'sesame', 'spicy'], price(10, 30)),
    restaurant('武汉', '严老幺烧卖', '粮道街 / 武昌', '烧卖和过早小吃', ['meat', 'pork'], price(10, 35), undefined, 1),
    localProject('武汉', '宝善堂菜市场逛吃', '武昌老城', '把菜市场和过早组合成一条本地生活线，再顺接粮道街或昙华林。', ['本地人项目', '菜市场', '过早'], undefined, 2),
  ],
  昆明: [
    restaurant('昆明', '芳香小吃', '昆明老城', '米线和本地小吃', ['spicy', 'meat'], price(15, 45), communitySource('芳香小吃', bilibili.昆明芳香小吃)),
    restaurant('昆明', '每天饭店', '昆明社区片区', '苍蝇馆子和家常菜', ['spicy', 'meat'], price(35, 90), communitySource('每天饭店', bilibili.昆明每天饭店), 1),
    restaurant('昆明', '爱尚菌·云南真野生菌火锅（翠湖公园店）', '翠湖公园南门', '真野生菌拼盘、鸡汤锅底和云南菜', ['meat'], price(90, 180), undefined, 2),
    localProject('昆明', '篆新农贸市场早走', '五华 / 盘龙交界', '上午看鲜花、蔬菜和本地早餐，再接翠湖或文林街，不和滇池远线同日硬拼。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  三亚: [
    restaurant('三亚', '沿江海南鸡饭店', '三亚老城', '海南鸡饭和本地家常菜', ['meat'], price(35, 90)),
    restaurant('三亚', '阿浪海鲜', '第一市场片区', '海鲜加工和海岛餐饮', ['seafood'], price(100, 260), undefined, 1),
    restaurant('三亚', '椰语堂清补凉', '三亚老城 / 第一市场', '清补凉和热带甜品', ['dairy'], price(15, 35), undefined, 2),
    restaurant('三亚', '嗲嗲的椰子鸡（大东海店）', '大东海片区', '椰子鸡和海南家常菜', ['meat'], price(90, 180), undefined, 3),
    restaurant('三亚', '不仔客海鲜（大东海店）', '大东海片区', '海鲜和海南风味菜', ['seafood'], price(100, 260), undefined, 4),
    localProject('三亚', '第一市场早走', '天涯 / 第一市场', '早晨先逛市场和老城，再决定是否用餐；海鲜过敏者只保留非海鲜路线。', ['本地人项目', '早市', '菜市场'], undefined, 5),
  ],
  桂林: [
    restaurant('桂林', '明桂米粉', '桂林老城', '桂林米粉和卤味小吃', ['meat', 'spicy'], price(10, 35)),
    restaurant('桂林', '崇善米粉', '象山 / 老城', '本地米粉早餐', ['meat', 'spicy'], price(10, 35), undefined, 1),
    localProject('桂林', '桂林老城夜走', '象山 / 秀峰', '两江四湖、老街和夜间小吃按同一片区串联，避免阳朔远线与市区夜游重复。', ['本地人项目', '夜逛', '城市漫步'], undefined, 2),
  ],
  哈尔滨: [
    restaurant('哈尔滨', '六顺园清真菜', '道外老城', '清真东北菜和老店家常味', ['meat'], price(45, 110), communitySource('六顺园清真菜', bilibili.哈尔滨六顺园)),
    restaurant('哈尔滨', '毛毛熏肉大饼', '道里 / 老城', '熏肉大饼和东北小吃', ['meat', 'pork'], price(20, 55), undefined, 1),
    localProject('哈尔滨', '安静街早市逛吃', '道里区', '冬季缩短室外停留，早餐和早市看完再接中央大街老城线。', ['本地人项目', '早市', '市井烟火'], undefined, 2),
  ],
  贵阳: [
    restaurant('贵阳', '丝恋红汤丝娃娃', '南明 / 老城', '丝娃娃和贵州蘸水', ['spicy'], price(25, 70)),
    restaurant('贵阳', '老凯俚酸汤鱼', '南明 / 云岩', '酸汤鱼和贵州菜', ['spicy', 'seafood'], price(80, 180), undefined, 1),
    localProject('贵阳', '民生路夜逛', '云岩老城', '把民生路、青云市集和老城小吃作为一条夜间线，忌辣者逐项确认蘸水。', ['本地人项目', '夜市', '逛吃'], undefined, 2),
  ],
  张家界: [
    restaurant('张家界', '胡师傅三下锅', '永定老城', '三下锅和湘西家常菜', ['spicy', 'meat'], price(55, 130)),
    restaurant('张家界', '老武鱼头', '永定区', '鱼头和湘西菜', ['spicy', 'seafood'], price(60, 150), undefined, 1),
    localProject('张家界', '南门口美食街夜逛', '永定老城', '景区之外安排一段本地夜逛，和天门山、武陵源分别规划，不跨区赶饭。', ['本地人项目', '夜逛', '逛吃'], undefined, 2),
  ],
  康定: [
    restaurant('康定', '康定牦牛肉汤锅', '新城 / 老城', '牦牛肉、菌汤和川西高原餐饮', ['meat'], price(55, 130), communitySource('康定美食地图', bilibili.康定美食地图)),
    localProject('康定', '溜溜城夜逛', '康定老城', '适合抵达日慢走、看锅庄和找小吃；高原行程不把夜间活动排得过满。', ['本地人项目', '夜逛', '高原慢走'], undefined, 1),
  ],
  稻城亚丁: [
    restaurant('稻城亚丁', '扎西德勒', '香格里拉镇', '藏餐和高原小镇用餐', ['meat', 'dairy'], price(45, 120), communitySource('扎西德勒', bilibili.稻城扎西德勒)),
    localProject('稻城亚丁', '香格里拉镇夜逛', '香格里拉镇', '把适应海拔、补水和小镇慢走放在抵达日，第二天再进入亚丁景区。', ['本地人项目', '高原慢走', '夜逛'], undefined, 1),
  ],
  九寨沟: [
    restaurant('九寨沟', '藏家小菜', '沟口', '藏家风味和当地家常菜', ['meat', 'dairy'], price(45, 120), communitySource('藏家小菜', bilibili.九寨藏家小菜)),
    localProject('九寨沟', '沟口藏寨夜逛', '沟口片区', '景区出入口附近安排轻量晚间体验，避免游览九寨沟后再跨远距离找饭。', ['本地人项目', '夜逛', '藏族文化'], undefined, 1),
  ],
  大理: [
    restaurant('大理', '再回首凉鸡米线', '大理古城', '凉鸡米线和本地小吃', ['meat', 'spicy'], price(15, 45)),
    restaurant('大理', '段公子', '大理古城', '云南菜和地方家常菜', ['spicy', 'meat'], price(60, 150), undefined, 1),
    localProject('大理', '才村码头骑行', '洱海西岸', '沿洱海西岸选一段骑行，和古城夜逛分开安排，不把环湖当成半日任务。', ['本地人项目', '骑行', '滨水'], undefined, 2),
  ],
  丽江: [
    restaurant('丽江', '阿婆腊排骨', '古城 / 束河', '腊排骨火锅', ['meat', 'pork'], price(55, 130)),
    restaurant('丽江', '唠叨坊纳西小吃', '丽江古城', '纳西小吃和本地家常味', ['meat', 'spicy'], price(25, 75), undefined, 1),
    localProject('丽江', '忠义市场早走', '丽江古城南侧', '早晨看菜市场和本地早餐，之后顺接古城南线，避免古城与玉龙雪山反复折返。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  香格里拉: [
    restaurant('香格里拉', '玛吉阿米', '独克宗古城', '藏式餐饮和古城用餐', ['meat', 'dairy'], price(60, 160)),
    restaurant('香格里拉', '吉祥如意藏餐', '独克宗古城', '藏餐和牦牛肉风味', ['meat', 'dairy'], price(45, 120), undefined, 1),
    localProject('香格里拉', '独克宗古城转经', '独克宗古城', '安排在傍晚或清晨慢走，给高原适应留余量，不与松赞林寺远线交叉。', ['本地人项目', '高原慢走', '古城'], undefined, 2),
  ],
  西双版纳: [
    restaurant('西双版纳', '多哥水傣味餐厅', '景洪市区', '傣味和本地酸辣口味', ['spicy', 'seafood'], price(55, 140), communitySource('多哥水傣味餐厅', bilibili.西双版纳多哥水)),
    restaurant('西双版纳', '曼飞龙烤鸡', '景洪 / 告庄', '傣味烤鸡和烧烤', ['meat', 'spicy'], price(45, 120), undefined, 1),
    localProject('西双版纳', '星光夜市慢逛', '告庄西双景', '把夜市当作夜间散步和小吃选择，用户忌辣或海鲜时逐摊确认，不默认全都适合。', ['本地人项目', '夜市', '逛吃'], undefined, 2),
  ],
  腾冲: [
    restaurant('腾冲', '寸大官私房菜', '腾冲老城', '腾冲家常菜和地方风味', ['meat', 'spicy'], price(45, 120), communitySource('寸大官私房菜', bilibili.腾冲寸大官)),
    restaurant('腾冲', '大救驾老字号', '腾冲老城', '大救驾和腾冲米食', ['meat'], price(20, 60), undefined, 1),
    localProject('腾冲', '和顺古镇早走', '和顺古镇', '早晨在古镇和菜市场慢走，再安排热海或火山方向，避免一天同时跨多个远郊点。', ['本地人项目', '早市', '古镇'], undefined, 2),
  ],
  沈阳: [
    restaurant('沈阳', '马家小吃部', '沈河 / 老城', '东北小吃和清真风味', ['meat'], price(20, 60), communitySource('马家小吃部', bilibili.沈阳马家小吃部)),
    restaurant('沈阳', '老边饺子', '沈河老城', '老字号饺子和东北菜', ['meat', 'pork'], price(45, 120), undefined, 1),
    localProject('沈阳', '西塔夜逛', '和平区', '把朝鲜族餐饮、夜市和街区慢走放在一条线，适合晚餐后就近回酒店。', ['本地人项目', '夜逛', '逛吃'], undefined, 2),
  ],
  大连: [
    restaurant('大连', '日丰园海肠水饺', '中山区', '海肠水饺和海滨城市水产', ['seafood'], price(55, 140)),
    restaurant('大连', '喜鼎海胆水饺', '中山 / 星海片区', '海胆水饺和海鲜饺子', ['seafood'], price(80, 220), undefined, 1),
    localProject('大连', '东港海岸骑行', '东港商务区', '傍晚沿海岸选一段骑行或散步，把滨海路线安排成连续一条线。', ['本地人项目', '骑行', '海边慢走'], undefined, 2),
  ],
  长春: [
    restaurant('长春', '樱花小吃', '老城居民区', '社区小吃和老店家常味', ['meat', 'pork'], price(20, 60), communitySource('长春樱花小吃', bilibili.长春樱花小吃)),
    restaurant('长春', '老韩头清真馆', '南关 / 老城', '清真东北菜和熟食', ['meat'], price(35, 100), undefined, 1),
    localProject('长春', '桂林路夜逛', '朝阳区', '把街区小吃、年轻人夜生活和附近商圈安排在同一晚，避免再跨净月潭。', ['本地人项目', '夜逛', '逛吃'], undefined, 2),
  ],
  延吉: [
    restaurant('延吉', '全州拌饭', '延边大学片区', '朝鲜族拌饭和家常菜', ['meat', 'spicy'], price(35, 90)),
    restaurant('延吉', '顺姬冷面', '延吉老城', '冷面和朝鲜族小吃', ['meat', 'spicy'], price(25, 70), undefined, 1),
    localProject('延吉', '水上市场早市', '延吉老城', '早晨吃小吃、看市场和居民日常，再接延边大学或民俗园路线。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  漠河: [
    restaurant('漠河', '北极村农家菜', '北极村', '东北农家菜和铁锅炖', ['meat', 'pork'], price(45, 120)),
    localProject('漠河', '北极村找北路线', '北极村', '把邮局、最北点位和村内慢走连成一条线，冬季根据体感缩短户外停留。', ['本地人项目', '找北', '村落慢走'], undefined, 1),
    localProject('漠河', '漠河舞厅夜体验', '漠河县城', '作为县城夜间文化节点，先确认开放状态，再安排在返程前的轻量时段。', ['本地人项目', '夜间文化', '室内'], undefined, 2),
  ],
  温州: [
    restaurant('温州', '县前汤圆', '鹿城老城', '温州汤圆和传统点心', ['meat', 'pork'], price(15, 45)),
    restaurant('温州', '长人馄饨', '五马街 / 鹿城', '馄饨和温州早餐', ['meat', 'pork'], price(15, 45), undefined, 1),
    localProject('温州', '瓦市菜场逛吃', '鹿城老城', '早晨从菜市场和早餐开始，再顺接五马街、朔门街老城线。', ['本地人项目', '早市', '菜市场'], undefined, 2),
  ],
  台州: [
    restaurant('台州', '炎森饭店', '台州老城', '家常硬菜和苍蝇馆子体验', ['seafood', 'meat'], price(45, 110), communitySource('炎森饭店', bilibili.台州炎森饭店)),
    restaurant('台州', '新荣记', '临海 / 台州府城', '台州菜和精致海鲜', ['seafood'], price(180, 450), undefined, 1),
    localProject('台州', '紫阳街早走', '临海古城', '早晨看古城、早餐和街坊店铺，之后再去台州府城墙或海岸远线。', ['本地人项目', '早市', '古城'], undefined, 2),
  ],
  丽水: [
    restaurant('丽水', '老陶大馄饨', '丽水老城', '馄饨和本地早餐', ['meat', 'pork'], price(15, 50), communitySource('老陶大馄饨', bilibili.丽水老陶)),
    restaurant('丽水', '云禾小吃店', '云和老城', '云和本地小吃', ['meat'], price(15, 55), communitySource('云禾小吃店', bilibili.丽水云禾), 1),
    localProject('丽水', '松阳老街晨走', '松阳古城', '适合把古村、老街和早餐放在一条慢线，和古堰画乡、仙都远线分日安排。', ['本地人项目', '早市', '古村慢走'], undefined, 2),
  ],
  乌鲁木齐: [
    restaurant('乌鲁木齐', '米拉吉', '天山区', '新疆菜和民族风味', ['meat', 'spicy'], price(60, 160)),
    restaurant('乌鲁木齐', '楼兰秘烤', '天山区 / 老城', '烤肉和新疆烧烤', ['meat', 'spicy'], price(50, 140), undefined, 1),
    localProject('乌鲁木齐', '二道桥巴扎逛吃', '天山区老城', '把巴扎、馕房和夜间餐饮放在同一片区，清真饮食和配料按门店确认。', ['本地人项目', '巴扎', '逛吃'], undefined, 2),
  ],
  喀什: [
    restaurant('喀什', '艾力扎提美食', '喀什古城', '新疆家常菜和民族风味', ['meat', 'spicy'], price(45, 130)),
    restaurant('喀什', '凯麦尔丁蓝鸽子', '喀什老城', '鸽子汤和本地早餐', ['meat'], price(30, 90), undefined, 1),
    localProject('喀什', '百年茶馆喝茶', '喀什古城', '把茶馆、老城巷道和手工艺店安排在同一段慢走，尊重宗教场所和居民生活。', ['本地人项目', '茶馆', '老城慢走'], undefined, 2),
  ],
  拉萨: [
    restaurant('拉萨', '光明港琼甜茶馆', '八廓街 / 老城', '甜茶和本地茶馆生活', ['dairy'], price(10, 35)),
    restaurant('拉萨', '娜玛瑟德餐厅', '八廓街', '藏式与尼泊尔风味餐饮', ['meat', 'dairy'], price(45, 130), undefined, 1),
    localProject('拉萨', '八廓街转经慢走', '八廓街', '安排在清晨或傍晚，保持顺时针行走并给高原适应留足时间。', ['本地人项目', '高原慢走', '人文'], undefined, 2),
  ],
  林芝: [
    restaurant('林芝', '鲁朗石锅王', '鲁朗镇', '石锅鸡和高原菌类', ['meat'], price(70, 180)),
    restaurant('林芝', '鲁朗石锅鸡', '鲁朗镇', '石锅鸡和川藏风味', ['meat'], price(70, 180), undefined, 1),
    localProject('林芝', '尼洋河晨走', '八一镇', '以八一镇河岸和农贸市场作为低强度晨间体验，远线景区另行安排。', ['本地人项目', '晨走', '滨水'], undefined, 2),
  ],
}

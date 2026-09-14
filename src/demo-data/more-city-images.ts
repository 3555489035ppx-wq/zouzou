import type { CityImage } from './city-images'

const commonsPage = (title: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`
const commonsFile = (title: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=1280`
const reusePage = 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia'

const image = (src: string, alt: string, landmark: string, title: string): CityImage => ({
  src: `/assets/cities/${src}`,
  alt,
  landmark,
  sourceUrl: commonsPage(title),
  credit: 'Wikimedia Commons 来源页',
  license: '以来源页标注为准',
  licenseUrl: reusePage,
  downloadUrl: commonsFile(title),
})

/** Clean architectural and landscape covers for the newly added city cards. */
export const moreCityImages: Record<string, CityImage> = {
  天津: image('tianjin-eye.jpg', '天津之眼与海河夜景', '天津之眼', '炫彩津门11Tianjin Eye and Haihe River.jpg'),
  济南: image('jinan-baotu.jpg', '趵突泉园林与泉水景观', '趵突泉', 'China Jinan Baotu Spring 5196935.jpg'),
  福州: image('fuzhou-cover.jpg', '福建博物院外观与天空', '福建博物院', 'Fuzhou Fujian Bowuyuan 2019.03.13 13-34-32.jpg'),
  宁波: image('ningbo-tianyi.jpg', '宁波天一阁园林建筑', '天一阁博物院', 'Tianyi Pavilion, Ningbo.jpg'),
  无锡: image('wuxi-qingming.jpg', '无锡清名桥与古运河', '清名桥历史文化街区', 'Wuxi Qingming Bridge 2019-10-14.jpg'),
  合肥: image('hefei-museum.jpg', '安徽博物院室内展陈建筑', '安徽博物院', '2012 Anhui Provincial History Museum 3.jpg'),
  南昌: image('nanchang-cover.jpg', '南昌江西省博物馆建筑外观', '江西省博物馆', 'Nanchang Exhibition Building.jpg'),
  郑州: image('zhengzhou-erqi.jpg', '郑州二七纪念塔城市地标', '二七纪念塔', '20240920 Erqi Memorial Tower 01.jpg'),
  洛阳: image('luoyang-longmen.jpg', '龙门石窟佛像雕刻细节', '龙门石窟', 'Longmen Grottoes, Luoyang, Henan.jpg'),
  兰州: image('lanzhou-cover.jpg', '兰州黄河母亲雕塑与山景', '黄河母亲雕塑', 'MotherHuanghe2.jpg'),
  西宁: image('xining-mosque.jpg', '西宁东关清真大寺建筑', '东关清真大寺', 'Dongguan mosque Xining.jpg'),
  海口: image('haikou-cover.jpg', '海口世纪大桥与海湾', '世纪大桥', 'Haikou Century Bridge-1.jpg'),
  珠海: image('zhuhai-fisher-girl.jpg', '珠海渔女与海湾景色', '珠海渔女', 'Zhuhai Fisher Girl statue dllu.jpg'),
  泉州: image('quanzhou-kaiyuan.jpg', '泉州开元寺古建筑院落', '泉州开元寺', 'The courtyard of Quanzhou Kaiyuan Temple 20170727.jpg'),
  银川: image('yinchuan-drum.jpg', '银川鼓楼城市地标', '银川鼓楼', 'YichuanDrumTower.jpg'),
  呼和浩特: image('hohhot-dazhao.jpg', '呼和浩特大召寺建筑与院落', '大召寺', 'Dazhao_Temple_20230730.jpg'),
  太原: image('taiyuan-jinci.jpg', '太原晋祠古建筑与园林', '晋祠博物馆', 'Jinci Temple (54573021971).jpg'),
  南宁: image('nanning-qingxiu.jpg', '从青秀山眺望南宁城市天际线', '青秀山', 'Nanning seen from Qingxiu Mountain.jpg'),
  宜昌: image('yichang-dam.jpg', '三峡大坝与长江山水', '三峡大坝旅游区', 'Three Gorges Dam.jpg'),
  威海: image('weihai-happiness.jpg', '威海海滨城市与天际线', '威海公园', 'Weihai.jpg'),
}

const citySlugs: Record<string, string> = {
  天津: 'tianjin', 济南: 'jinan', 福州: 'fuzhou', 宁波: 'ningbo', 无锡: 'wuxi',
  合肥: 'hefei', 南昌: 'nanchang', 郑州: 'zhengzhou', 洛阳: 'luoyang', 兰州: 'lanzhou',
  西宁: 'xining', 海口: 'haikou', 珠海: 'zhuhai', 泉州: 'quanzhou', 银川: 'yinchuan',
  呼和浩特: 'hohhot', 太原: 'taiyuan', 南宁: 'nanning', 宜昌: 'yichang', 威海: 'weihai',
}

/**
 * The first stop of each of the fifteen city guides is also its cover subject.
 * The image files are clean, local derivatives of the curated city photo pool;
 * the metadata still points back to the original public source page.
 */
export const routeCoverSubjects: Record<string, string[]> = {
  天津: ['天津之眼', '天津古文化街', '天津博物馆', '盘山风景名胜区', '鼓楼', '海河解放桥', '狗不理包子', '天津包子', '五大道晨走', '天津自然博物馆', '意风区咖啡休息', '杨柳青古镇慢逛', '五大道历史文化街区', '贴饽饽熬小鱼', '天津美术馆'],
  济南: ['趵突泉', '曲水亭街', '山东博物馆', '红叶谷生态文化旅游区', '解放阁', '宽厚里夜逛', '油旋', '草包包子', '护城河散步', '大明湖', '百花洲慢走', '千佛山', '老商埠街区', '济南锅贴', '山东美术馆'],
  福州: ['三坊七巷', '烟台山历史风貌区', '福建博物院', '鼓山风景区', '上下杭历史文化街区', '闽江夜景', '佛跳墙', '福州线面', '闽江江滨散步', '乌塔', '烟台山咖啡休息', '平潭岛', '上下杭夜走', '肉燕', '林则徐纪念馆'],
  宁波: ['天一阁博物院', '鼓楼', '宁波博物馆', '月湖公园', '阿育王寺', '宁波老外滩', '宁波年糕', '海鲜面', '三江口散步', '东钱湖', '宁波书城休息', '象山影视城', '天一阁周边慢走', '宁波烤鸭', '宁波美术馆'],
  无锡: ['鼋头渚', '惠山古镇', '无锡博物院', '蠡园', '东林书院', '南长街', '无锡小笼', '鸡子大饼', '清名桥拍照', '灵山大佛', '蠡湖散步', '无锡油面筋', '清名桥历史文化街区', '惠山油酥', '东林书院慢看'],
  合肥: ['包公园', '逍遥津公园', '安徽博物院', '巢湖风景区', '李鸿章故居', '淮河路夜逛', '李鸿章大杂烩', '鸭油烧饼', '合柴文创慢看', '三河古镇', '三河老街慢走', '三河米饺', '合柴1972', '牛肉面', '安徽名人馆'],
  南昌: ['滕王阁', '绳金塔', '江西省博物馆', '梅岭国家森林公园', '八一广场', '秋水广场', '南昌拌粉', '瓦罐汤', '绳金塔街区慢走', '八大山人纪念馆', '赣江边散步', '梅岭轻徒步', '699文化创意园', '藜蒿炒腊肉', '八一起义纪念馆'],
  郑州: ['河南博物院', '二七纪念塔', '郑州博物馆', '黄河风景名胜区', '少林寺', '郑东新区CBD大玉米', '胡辣汤', '油馍头', '人民公园', '只有河南戏剧幻城', '商都遗址博物院', '建业电影小镇', '中原福塔观景', '羊肉烩面', '河南博物院看展'],
  洛阳: ['龙门石窟', '丽景门', '应天门遗址博物馆', '王城公园', '白马寺', '洛邑古城', '羊肉汤', '胡辣汤', '洛阳老城晨走', '洛阳博物馆', '洛河沿线散步', '老君山风景区', '应天门灯光外观', '洛阳水席', '古墓博物馆'],
  兰州: ['中山桥', '兰州老街', '甘肃省博物馆', '白塔山公园', '五泉山公园', '黄河母亲雕塑', '酿皮', '兰州牛肉面', '正宁路夜逛', '兴隆山国家森林公园', '大众巷慢走', '水车园散步', '牛奶鸡蛋醪糟', '手抓羊肉', '读者博物馆'],
  西宁: ['东关清真大寺', '莫家街', '青海省博物馆', '南山公园', '塔尔寺', '南山公园看日落', '羊肉串', '羊肠面', '北山土楼观短线', '日月山', '清真街区慢走', '塔尔寺文化线', '东关寺周边晨走', '甜醅', '青海藏文化博物院'],
  海口: ['骑楼老街', '骑楼小吃街逛吃', '海南省博物馆', '万绿园', '五公祠', '假日海滩', '海南粉', '得胜沙市场', '世纪大桥夜景', '观澜湖度假区', '老爸茶', '雷琼海口火山群世界地质公园', '云洞图书馆', '糟粕醋', '云洞图书馆看海'],
  珠海: ['珠海渔女', '唐家湾老街', '珠海博物馆', '景山公园', '日月贝歌剧院', '香炉湾沙滩', '横琴蚝', '肠粉', '情侣路晨走', '唐家湾古镇', '叉烧包', '东澳岛', '港珠澳大桥观景点', '澳门葡挞', '情侣路'],
  泉州: ['泉州开元寺', '西街', '泉州海外交通史博物馆', '清源山风景区', '洛阳桥', '关岳庙夜走', '面线糊', '泉州牛肉羹', '蟳埔簪花体验', '崇武古城', '承天寺', '洛阳桥散步', '中山路骑楼', '四果汤', '东海泰禾看海'],
  银川: ['镇北堡西部影城', '银川鼓楼', '宁夏博物馆', '沙湖生态旅游区', '南关清真大寺', '览山公园', '手抓羊肉', '羊杂碎', '中山公园', '西夏王陵', '八宝茶', '贺兰山岩画', '览山公园看城景', '羊肉臊子面', '宁夏博物馆看展'],
  呼和浩特: ['大召寺', '清真大寺', '内蒙古博物院', '哈素海', '昭君博物院', '摩尔城夜逛', '烧麦', '焙子', '伊斯兰风情街', '席力图召', '奶茶', '内蒙古美术馆', '呼和浩特老城慢走', '手把肉', '内蒙古博物院看展'],
  太原: ['晋祠博物馆', '柳巷', '山西博物院', '迎泽公园', '双塔寺', '柳巷夜逛', '刀削面', '头脑', '晋祠晨走', '汾河公园', '钟楼街慢走', '青龙古镇短线', '双塔寺拍照', '百花烧麦', '中国煤炭博物馆'],
  南宁: ['青秀山风景区', '三街两巷', '南宁博物馆', '大明山国家级自然保护区', '扬美古镇', '民歌湖', '螺蛳粉', '卷筒粉', '青秀山晨走', '广西科技馆', '邕江滨水线', '南湖公园', '方特东盟神画', '粉虫', '广西民族博物馆'],
  宜昌: ['三峡大坝旅游区', '夷陵广场', '宜昌博物馆', '清江画廊', '天然塔', '葛洲坝', '萝卜饺子', '宜昌豆花', '小溪塔老街', '三峡人家', '宜昌老城慢走', '西陵峡', '天然塔拍照', '长江鱼宴', '万达夜逛'],
  威海: ['刘公岛', '火炬八街', '威海博物馆', '猫头山', '那香海', '国际海水浴场', '鲅鱼饺子', '海菜包子', '海源公园散步', '幸福门', '威海老城慢走', '成山头', '火炬八街拍照', '喜饼', '刘公岛码头看海'],
}

export const moreCityGalleryImages: Record<string, CityImage[]> = Object.fromEntries(
  Object.entries(routeCoverSubjects).map(([city, subjects]) => {
    const base = moreCityImages[city]
    const slug = citySlugs[city]
    return [city, subjects.map((landmark, index) => ({
      ...base,
      src: `/assets/cities/${slug}-route-${String(index + 1).padStart(2, '0')}.jpg`,
      alt: `${city}${landmark}实景`,
      landmark,
      routeEligible: false,
    }))]
  }),
) as Record<string, CityImage[]>

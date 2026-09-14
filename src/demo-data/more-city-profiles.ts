import type { CityProfile } from './cities'

/**
 * Third coverage layer: mainstream city destinations that are useful for a
 * national itinerary plaza. These are city-level anchors; route stops still
 * come from the knowledge catalog and open in the user's map app.
 */
export const moreCityProfiles: Record<string, CityProfile> = {
  天津: { mapCenter: [117.2009, 39.0842], weather: { latitude: 39.0842, longitude: 117.2009 }, demoLabels: ['天津之眼', '五大道', '意式风情区', '天津博物馆', '煎饼果子'], routeScale: 0.58 },
  济南: { mapCenter: [117.1201, 36.6512], weather: { latitude: 36.6512, longitude: 117.1201 }, demoLabels: ['趵突泉', '大明湖', '曲水亭街', '山东博物馆', '把子肉'], routeScale: 0.58 },
  福州: { mapCenter: [119.2965, 26.0745], weather: { latitude: 26.0745, longitude: 119.2965 }, demoLabels: ['三坊七巷', '烟台山', '上下杭', '福建博物院', '福州鱼丸'], routeScale: 0.58 },
  宁波: { mapCenter: [121.544, 29.8683], weather: { latitude: 29.8683, longitude: 121.544 }, demoLabels: ['天一阁', '老外滩', '月湖公园', '宁波博物馆', '宁波汤圆'], routeScale: 0.58 },
  无锡: { mapCenter: [120.3119, 31.4912], weather: { latitude: 31.4912, longitude: 120.3119 }, demoLabels: ['鼋头渚', '惠山古镇', '南长街', '拈花湾', '无锡小笼'], routeScale: 0.58 },
  合肥: { mapCenter: [117.2272, 31.8206], weather: { latitude: 31.8206, longitude: 117.2272 }, demoLabels: ['包公园', '安徽博物院', '三河古镇', '合柴1972', '鸭油烧饼'], routeScale: 0.58 },
  南昌: { mapCenter: [115.8582, 28.6829], weather: { latitude: 28.6829, longitude: 115.8582 }, demoLabels: ['滕王阁', '八一广场', '万寿宫', '秋水广场', '南昌拌粉'], routeScale: 0.58 },
  郑州: { mapCenter: [113.6254, 34.7466], weather: { latitude: 34.7466, longitude: 113.6254 }, demoLabels: ['河南博物院', '二七纪念塔', '郑州博物馆', '黄河风景名胜区', '胡辣汤'], routeScale: 0.58 },
  洛阳: { mapCenter: [112.454, 34.6197], weather: { latitude: 34.6197, longitude: 112.454 }, demoLabels: ['龙门石窟', '洛阳博物馆', '白马寺', '洛邑古城', '洛阳水席'], routeScale: 0.58 },
  兰州: { mapCenter: [103.8343, 36.0611], weather: { latitude: 36.0611, longitude: 103.8343 }, demoLabels: ['中山桥', '黄河母亲', '甘肃省博物馆', '白塔山', '兰州牛肉面'], routeScale: 0.58 },
  西宁: { mapCenter: [101.7782, 36.6171], weather: { latitude: 36.6171, longitude: 101.7782 }, demoLabels: ['东关清真大寺', '青海省博物馆', '南山公园', '莫家街', '手抓羊肉'], routeScale: 0.58 },
  海口: { mapCenter: [110.1983, 20.044], weather: { latitude: 20.044, longitude: 110.1983 }, demoLabels: ['骑楼老街', '云洞图书馆', '万绿园', '海南省博物馆', '海南鸡饭'], routeScale: 0.58 },
  珠海: { mapCenter: [113.5767, 22.2707], weather: { latitude: 22.2707, longitude: 113.5767 }, demoLabels: ['珠海渔女', '情侣路', '日月贝', '唐家湾古镇', '椰子鸡'], routeScale: 0.58 },
  泉州: { mapCenter: [118.6757, 24.8741], weather: { latitude: 24.8741, longitude: 118.6757 }, demoLabels: ['开元寺', '西街', '清源山', '洛阳桥', '面线糊'], routeScale: 0.58 },
  银川: { mapCenter: [106.2309, 38.4872], weather: { latitude: 38.4872, longitude: 106.2309 }, demoLabels: ['鼓楼', '宁夏博物馆', '西夏王陵', '阅海公园', '手抓羊肉'], routeScale: 0.58 },
  呼和浩特: { mapCenter: [111.7492, 40.8426], weather: { latitude: 40.8426, longitude: 111.7492 }, demoLabels: ['大召寺', '内蒙古博物院', '塞上老街', '昭君博物院', '烧麦'], routeScale: 0.58 },
  太原: { mapCenter: [112.5489, 37.8706], weather: { latitude: 37.8706, longitude: 112.5489 }, demoLabels: ['晋祠', '山西博物院', '柳巷', '双塔寺', '刀削面'], routeScale: 0.58 },
  南宁: { mapCenter: [108.3669, 22.817,], weather: { latitude: 22.817, longitude: 108.3669 }, demoLabels: ['青秀山', '三街两巷', '广西民族博物馆', '南湖公园', '老友粉'], routeScale: 0.58 },
  宜昌: { mapCenter: [111.2865, 30.6918], weather: { latitude: 30.6918, longitude: 111.2865 }, demoLabels: ['三峡大坝', '葛洲坝', '滨江公园', '宜昌博物馆', '凉虾'], routeScale: 0.58 },
  威海: { mapCenter: [122.1204, 37.5131], weather: { latitude: 37.5131, longitude: 122.1204 }, demoLabels: ['刘公岛', '威海公园', '幸福门', '火炬八街', '海鲜疙瘩汤'], routeScale: 0.58 },
}

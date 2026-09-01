import type { CityProfile } from './cities'

/**
 * Representative city and destination profiles added for the second coverage
 * layer. Coordinates are city-level map anchors; individual POIs remain
 * subject to the same live map verification as the original 20 cities.
 */
export const regionalCityProfiles: Record<string, CityProfile> = {
  康定: { mapCenter: [101.956, 30.051], weather: { latitude: 30.051, longitude: 101.956 }, demoLabels: ['溜溜城', '木格措', '康定情歌广场', '新都桥', '牦牛肉菌汤锅'], routeScale: 0.58 },
  稻城亚丁: { mapCenter: [100.297, 29.037], weather: { latitude: 29.037, longitude: 100.297 }, demoLabels: ['稻城亚丁景区', '冲古寺', '洛绒牛场', '香格里拉镇', '藏式晚餐'], routeScale: 0.58 },
  九寨沟: { mapCenter: [103.599, 33.263], weather: { latitude: 33.263, longitude: 103.599 }, demoLabels: ['九寨沟风景名胜区', '五花海', '诺日朗瀑布', '沟口藏寨', '牦牛肉汤锅'], routeScale: 0.58 },
  大理: { mapCenter: [100.267, 25.606], weather: { latitude: 25.606, longitude: 100.267 }, demoLabels: ['大理古城', '洱海生态廊道', '崇圣寺三塔', '龙龛码头', '白族菜晚餐'], routeScale: 0.58 },
  丽江: { mapCenter: [100.233, 26.872], weather: { latitude: 26.872, longitude: 100.233 }, demoLabels: ['丽江古城', '玉龙雪山', '蓝月谷', '束河古镇', '腊排骨火锅'], routeScale: 0.58 },
  香格里拉: { mapCenter: [99.708, 27.825], weather: { latitude: 27.825, longitude: 99.708 }, demoLabels: ['独克宗古城', '松赞林寺', '纳帕海', '普达措国家公园', '牦牛火锅'], routeScale: 0.58 },
  西双版纳: { mapCenter: [100.797, 22.002], weather: { latitude: 22.002, longitude: 100.797 }, demoLabels: ['告庄西双景', '曼听公园', '星光夜市', '热带植物园', '傣味手抓饭'], routeScale: 0.58 },
  腾冲: { mapCenter: [98.497, 25.017], weather: { latitude: 25.017, longitude: 98.497 }, demoLabels: ['和顺古镇', '热海景区', '火山地热公园', '银杏村', '大救驾'], routeScale: 0.58 },
  沈阳: { mapCenter: [123.431, 41.805], weather: { latitude: 41.805, longitude: 123.431 }, demoLabels: ['沈阳故宫', '张氏帅府', '中街步行街', '西塔街早市', '鸡架'], routeScale: 0.58 },
  大连: { mapCenter: [121.615, 38.914], weather: { latitude: 38.914, longitude: 121.615 }, demoLabels: ['星海广场', '滨海路', '中山广场', '东港音乐喷泉', '海菜包子'], routeScale: 0.58 },
  长春: { mapCenter: [125.324, 43.817], weather: { latitude: 43.817, longitude: 125.324 }, demoLabels: ['伪满皇宫博物院', '长影旧址博物馆', '净月潭', '这有山', '长春冷面'], routeScale: 0.58 },
  延吉: { mapCenter: [129.513, 42.904], weather: { latitude: 42.904, longitude: 129.513 }, demoLabels: ['延边大学', '中国朝鲜族民俗园', '西市场', '帽儿山', '延吉冷面'], routeScale: 0.58 },
  漠河: { mapCenter: [122.539, 52.972], weather: { latitude: 52.972, longitude: 122.539 }, demoLabels: ['北极村', '龙江第一湾', '北红村', '九曲十八弯', '东北铁锅炖'], routeScale: 0.58 },
  温州: { mapCenter: [120.699, 27.994], weather: { latitude: 27.994, longitude: 120.699 }, demoLabels: ['江心屿', '五马街', '南塘文化旅游区', '朔门街', '温州鱼丸'], routeScale: 0.58 },
  台州: { mapCenter: [121.420, 28.656], weather: { latitude: 28.656, longitude: 121.420 }, demoLabels: ['神仙居', '临海古城', '紫阳街', '石塘渔村', '台州糊'], routeScale: 0.58 },
  丽水: { mapCenter: [119.922, 28.468], weather: { latitude: 28.468, longitude: 119.922 }, demoLabels: ['古堰画乡', '仙都景区', '云和梯田', '松阳古村落', '缙云烧饼'], routeScale: 0.58 },
  乌鲁木齐: { mapCenter: [87.617, 43.826], weather: { latitude: 43.826, longitude: 87.617 }, demoLabels: ['国际大巴扎', '新疆博物馆', '红山公园', '天山天池', '烤羊肉串'], routeScale: 0.58 },
  喀什: { mapCenter: [75.990, 39.470], weather: { latitude: 39.470, longitude: 75.990 }, demoLabels: ['喀什古城', '艾提尕尔清真寺', '东巴扎', '高台民居', '烤包子'], routeScale: 0.58 },
  拉萨: { mapCenter: [91.141, 29.646], weather: { latitude: 29.646, longitude: 91.141 }, demoLabels: ['布达拉宫', '大昭寺', '八廓街', '色拉寺', '甜茶馆'], routeScale: 0.58 },
  林芝: { mapCenter: [94.362, 29.649], weather: { latitude: 29.649, longitude: 94.362 }, demoLabels: ['巴松措', '雅鲁藏布大峡谷', '鲁朗林海', '尼洋河', '鲁朗石锅鸡'], routeScale: 0.58 },
}

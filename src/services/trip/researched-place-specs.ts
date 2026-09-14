import type { CityAdditionalSpec } from './cityKnowledge.expanded'
import restaurantResearch from '../../../data/travel-research/2026-09-06-restaurants.json'

export function restaurantSourcesFor(city: string, name: string) {
  return restaurantResearch.restaurants.find(restaurant => restaurant.city === city && restaurant.name === name)?.sources ?? []
}

const source = (id: string) => ({ label: '小红书公开正文：餐饮体验线索', url: `https://www.xiaohongshu.com/explore/${id}`, kind: 'community' as const, checkedAt: '2026-09-06' })
function venue(name: string, area: string, address: string, menu: string[], summary: string, id: string, dietaryTags: string[]): CityAdditionalSpec {
  return {
    name, category: 'restaurant', area, venueName: name, address, searchKeyword: `${address} ${name}`,
    menuHighlights: menu, summary: `${summary} 这是一次公开体验中的门店线索，分店、营业、菜单和配料待出行前确认。`,
    tags: ['本地餐馆', '本地美食', '本地生活'], dietaryTags, durationMinutes: 60,
    price: { state: 'unknown', min: 0, max: 0, unit: 'person', note: '未获取当前菜单报价，不沿用帖子旧价格' },
    source: source(id),
  }
}

/** Only named venues explicitly present in read note bodies. No invented POI coordinates. */
export const researchedPlaceSpecs: Record<string, CityAdditionalSpec[]> = {
  宁波: [{
    name: '包玉刚故居', venueName: '包玉刚故居', category: 'attraction', area: '镇海区 / 后包巷',
    address: '宁波市镇海区后包巷', searchKeyword: '宁波 镇海 包玉刚故居 后包巷',
    summary: '想了解宁波人物与传统民居，可选择镇海的包玉刚故居。传统砖木建筑禁止明火、攀爬和触摸展品；适合镇海片区组合，不把跨区交通视作顺路。建议停留时长是规划估算。',
    tags: ['历史', '人物故居', '本地文化'], durationMinutes: 75,
    price: {min: 0, max: 0, unit: 'ticket', note: '官方参观指南明确免费开放；交通餐饮另计'},
    opening: {from: '09:00', to: '17:00', closedWeekdays: [1], label: '16:00停止入馆；法定节假日及台风公告另核对'},
    source: {kind: 'official', label: '宁波博物院：包玉刚故居参观指南', url: 'https://www.nbmuseum.cn/col/col20979/index.html', checkedAt: '2026-09-06'},
  }],
  南昌: [
    venue('秦胖子肉陀良心店', '西湖区 / 石头街', '南昌市西湖区石头街108号', ['牛肉拌粉', '瓦罐汤'], '把拌粉和瓦罐汤组合成老城早餐，不用为两样小吃跨片区找店。', '693c149d000000001e028b06', ['meat', 'beef', 'spicy']),
    venue('周记生煎（船山路店）', '西湖区 / 船山路', '南昌市西湖区船山路402号', ['生煎'], '老城生煎候选，适合在船山路一带补充一顿简餐；肉馅与过敏原需问店员。', '693c149d000000001e028b06', ['meat', 'pork', 'wheat']),
    venue('小吴水煮（羊子街店）', '西湖区 / 羊子街', '南昌市西湖区羊子街84号', ['水煮'], '羊子街附近的水煮体验，重辣汤底不适合直接给忌辣用户安排。', '693c149d000000001e028b06', ['spicy']),
    venue('广源隆饼庄', '西湖区 / 羊子巷', '南昌市西湖区羊子巷76号', ['油条包麻糍'], '油条与麻糍组合的小吃候选，可和羊子巷街区一起走，糖和芝麻配料现场确认。', '693c149d000000001e028b06', ['wheat', 'sesame']),
  ],
  合肥: [
    venue('百味屋砂锅店', '庐阳区 / 五河路', '合肥市五河路（具体门牌待确认）', ['鸡蛋饼'], '正文专门提到五河路小店的鸡蛋饼，适合逍遥津老城游览后顺片区找店。', '696b0107000000001a0228b4', ['egg', 'wheat']),
    venue('丁姐鸭血粉丝汤', '庐阳区 / 七桂塘', '合肥市七桂塘片区（具体门牌待确认）', ['鸭血粉丝汤'], '七桂塘早餐线索，鸭血属于动物性食材，素食用户应换其他餐食。', '696b0107000000001a0228b4', ['meat', 'duck']),
  ],
  福州: [
    venue('鑫福屿阿辉捞化', '福州城区 / 门店待确认', '福州市（分店地址待确认）', ['捞化'], '把捞化作为福州米粉和汤食体验；内脏、水产与汤底须按点单确认。', '6a3cb88a0000000008030a16', ['meat', 'seafood']),
    venue('莲花饭庄', '福州城区 / 门店待确认', '福州市（分店地址待确认）', ['爆炒双脆'], '正文提到的福州菜正餐候选，爆炒双脆的动物性原料及过敏原需逐项确认。', '6a3cb88a0000000008030a16', ['meat', 'seafood']),
  ],
  海口: [
    venue('三姐海南粉', '骑楼老街', '海口市骑楼老街（具体门牌待确认）', ['海南粉'], '骑楼老街游览中的海南粉线索；配料复杂，花生、水产和肉类不要只凭菜名判断。', '6a311fca0000000006022eeb', ['peanut', 'seafood', 'meat']),
  ],
}

for (const restaurant of restaurantResearch.restaurants) {
  const primary = restaurant.sources[0]
  const category = 'category' in restaurant && restaurant.category === 'food' ? 'food' : 'restaurant'
  const item: CityAdditionalSpec = {
    name: restaurant.name, venueName: restaurant.name, category, area: restaurant.area,
    address: restaurant.address, searchKeyword: `${restaurant.city} ${restaurant.name} ${restaurant.address}`,
    menuHighlights: restaurant.menu, dietaryTags: restaurant.dietaryTags,
    tags: ['本地餐馆', '本地美食', '本地生活'], durationMinutes: category === 'food' ? 35 : 75,
    summary: `${restaurant.summary} 菜单、营业及当日供应待门店确认；停留时长为规划估算。`,
    price: {state: 'unknown', min: 0, max: 0, unit: 'person', note: '未获取当前报价，不把旧人均消费当作本次餐费'},
    source: {label: primary.label, url: primary.url, checkedAt: restaurantResearch.checkedAt,
      kind: /(?:quanzhou\.gov\.cn|tongqinglou\.cn)/.test(primary.url) ? 'official' : 'community'},
  }
  ;(researchedPlaceSpecs[restaurant.city] ??= []).push(item)
}

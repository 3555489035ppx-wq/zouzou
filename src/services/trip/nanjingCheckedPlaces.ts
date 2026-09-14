import type { CityKnowledgeItem } from './cityKnowledge'

// Field evidence checked 2026-09-05. Indoor location is supported by the
// documented gallery / hotel floor / dining-room address. Prices are estimates.
export const nanjingCheckedPlaces: CityKnowledgeItem[] = [
  { id: 'nanjing-jiangsu-art-museum', name: '江苏省美术馆', category: 'attraction', area: '玄武区长江路', tags: ['室内', '展览', '艺术', '免预约散客'],
    address: '南京市长江路333号', durationMinutes: 90, price: { min: 0, max: 0, unit: 'ticket', state: 'unknown', note: '参观须知未列当期收费特展价格，特展费用另行核对' },
    opening: { from: '09:00', to: '17:00', closedWeekdays: [1], label: '周二至周日09:00—17:00，16:30停止入馆；周一闭馆，法定节假日例外须核对' },
    summary: '馆内观赏江苏美术及典藏陈列。散客无需提前预约，携身份证或社保卡等有效证件刷卡入馆；团队需电话预约025-89610810。具体展览、临时公告和收费项目出发前核对。',
    source: { label: '江苏省美术馆官方参观须知', url: 'https://www.jssmsg.cn/', kind: 'official', checkedAt: '2026-09-05' }, verified: false },
  { id: 'nanjing-meiyuan-indoor', name: '梅苑（金陵饭店）', category: 'restaurant', area: '鼓楼区新街口', tags: ['室内', '本地餐馆', '午餐', '晚餐', '淮扬菜'],
    address: '南京市鼓楼区汉中路2号金陵饭店2层', venueName: '梅苑（金陵饭店）', searchKeyword: '梅苑 金陵饭店 汉中路2号', durationMinutes: 75,
    price: { min: 350, max: 450, unit: 'person', note: '规划预留，不是餐厅报价；以实际点单为准' }, dietaryTags: ['meat', 'seafood'],
    summary: '酒店二层的中式餐厅，适合室内正餐。淮扬菜，含鸭肉及鱼类菜式。提前致电025-84701888确认午晚餐营业、座位和忌口，未完成订位。',
    source: { label: '米其林指南餐厅实地评介', url: 'https://guide.michelin.com/sg/zh_CN/jiang-su/nanjing_1029511/restaurant/plum-garden', kind: 'community', checkedAt: '2026-09-05' }, verified: false },
  { id: 'nanjing-xinfangyuan-indoor', name: '馨方园食府', category: 'restaurant', area: '秦淮区朝天宫', tags: ['室内', '本地餐馆', '午餐', '晚餐', '南京菜'],
    address: '南京市秦淮区堂子街57号108室', venueName: '馨方园食府', searchKeyword: '馨方园食府 堂子街57号108室', durationMinutes: 60,
    price: { min: 100, max: 180, unit: 'person', note: '规划预留，不是餐厅报价；以实际点单为准' }, dietaryTags: ['meat', 'seafood'],
    summary: '具体门牌为108室的南京菜餐厅，室内用餐；牛肉锅贴、鱼头汤等含肉及鱼类。餐厅自行接受订位，致电025-86591901核对营业时段、座位与过敏原。',
    source: { label: '米其林指南餐厅实地评介', url: 'https://guide.michelin.com/en/jiang-su/nanjing_1029511/restaurant/xin-fang-yuan', kind: 'community', checkedAt: '2026-09-05' }, verified: false },
]

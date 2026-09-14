import type { Route, Poi } from './discover'
import { discoverCoverIndex } from './discover-cover-index'
import { getCityKnowledge } from '../services/trip/cityKnowledge'
import { buildDailyAgenda } from '../services/trip/dailyAgenda'

/** Compose day plans from existing sourced city routes; never invent a POI. */
export function buildMultiDayRoutes(city: string, base: Route[]): Route[] {
  const pool = [...new Map(base.flatMap(route => route.pois).map(poi => [poi.name, poi])).values()]
  const results: Route[] = []
  const signature = (pois: Poi[]) => pois.map(poi => poi.name).sort().join('|')
  const signatures = new Set(base.map(route => signature(route.pois)))
  const minutes = (poi: Poi) => Number(poi.stay.match(/(\d+)min/)?.[1] ?? 0) + Number(poi.stay.match(/([\d.]+)h/)?.[1] ?? 0) * 60 || 60
  const sameArea = (a: Poi, b: Poi) => Boolean(a.area && b.area && a.area.split(/[ /—，、·-]+/).some(token => token.length >= 2 && b.area!.includes(token)))
  for (let days = 1; days <= 4; days++) {
    // Keep the original ids available for saved links; publish a longer-trip subset.
    for (let variant = 0; variant < (days >= 3 ? 8 : 5); variant++) {
      const anchor = base[(variant * 3 + days - 1) % base.length]
      if (!anchor || pool.length < days * 2) continue
      let selected: Poi[] = []
      let found = false
      for (let attempt = 0; attempt < pool.length * 2; attempt++) {
        const offset = (variant * 3 + days + attempt) % pool.length
        const ordered = [...pool.slice(offset), ...pool.slice(0, offset)]
        const remaining = [...ordered]
        selected = []
        for (let day = 1; day <= days; day++) {
          const first = remaining.shift()!
          const daily = [first]
          let usedMinutes = minutes(first)
          // Keep long visits on their own; otherwise pair nearby areas first.
          const candidates = [...remaining].sort((a, b) => Number(sameArea(first, b)) - Number(sameArea(first, a)))
          for (const candidate of candidates) {
            if (daily.length >= 3 || remaining.length <= days - day) break
            if (usedMinutes + minutes(candidate) + 30 > 420) continue
            if (daily.length > 1 && !sameArea(first, candidate)) continue
            daily.push(candidate)
            remaining.splice(remaining.indexOf(candidate), 1)
            usedMinutes += minutes(candidate) + 30
          }
          daily.sort((a,b) => Number(/夜逛|夜景|夜游|夜市/.test(a.name)) - Number(/夜逛|夜景|夜游|夜市/.test(b.name)))
          selected.push(...daily.map((poi, index) => ({ ...poi,
            id: `multi-${city}-${days}-${variant}-${day}-${index}`, day,
            transportation: index === 0 ? '当天起点；按住宿位置选择交通' : '打开手机地图确认当日转场',
          })))
        }
        const key = signature(selected)
        if (!signatures.has(key)) { signatures.add(key); found = true; break }
      }
      if (!found) continue
      const agenda=buildDailyAgenda({city,days,items:getCityKnowledge(city).items,variant,
        anchors:Array.from({length:days},(_,index)=>selected.filter(poi=>poi.day===index+1).map(poi=>poi.name))})
      selected=agenda.flatMap((day,index)=>day.entries.map((entry,stopIndex)=>{
        const existing=pool.find(poi=>poi.name===entry.item.name)
        return {
          ...existing,id:`multi-${city}-${days}-${variant}-${index+1}-${stopIndex}`,day:index+1,
          name:entry.item.name,cityId:city,category:['早餐','午餐','晚餐'].includes(entry.period)?entry.period:entry.item.category,
          time:entry.time,period:entry.period,stay:`${entry.duration}min`,
          area:entry.item.area,address:entry.item.address,searchKeyword:entry.item.searchKeyword??entry.item.name,
          sourceUrl:entry.item.source.url,image:existing?.image??'',
          introduction:entry.item.summary,priceState:entry.item.price.state??'estimated',estimatedBudget:Math.round((entry.item.price.min+entry.item.price.max)/2),
          transportation:stopIndex===0?'当天起点；按住宿位置选择交通':`规划预留${entry.transfer}分钟转场，实际路线请查看地图`,
        } satisfies Poi
      }))
      if(!selected.length)continue
      const sights=selected.filter(poi=>!['早餐','午餐','晚餐'].includes(poi.category))
      const duration = days === 1 ? '1天' : `${days}天${days - 1}晚`
      const coverRoute = base.find(route => selected.some(poi => poi.name === route.pois[0]?.name) && discoverCoverIndex[route.id]?.image)
      results.push({
        ...anchor, id: `multiday-${city}-${days}-${variant + 1}`, dayCount: days,
        title: `${city}${duration} · ${(sights[0]??selected[0]).name}到${(sights.at(-1)??selected.at(-1))!.name}`,
        summary: Array.from({ length: days }, (_, day) => `第${day + 1}天：${selected.filter(p => p.day === day + 1).map(p => p.name).join(' → ')}`).join('；'),
        category: '旅行', duration, pois: selected, timePeriod: ['上午'],
        cover: coverRoute ? discoverCoverIndex[coverRoute.id].image!.cachedUrl : selected.find(poi => poi.image)?.image || discoverCoverIndex[anchor.id]?.image?.cachedUrl || anchor.cover,
        sourceUrl: selected[0].sourceUrl ?? anchor.sourceUrl,
        tags: [duration, '分日游玩', ...anchor.tags.filter(tag => !/半日|夜景路线/.test(tag)).slice(0, 3)],
        budgetMin: selected.reduce((sum, poi) => sum + (poi.estimatedBudget ?? 0), 0), budgetMax: selected.reduce((sum, poi) => sum + (poi.estimatedBudget ?? 0), 0),
        recommendedReason: `按片区串联每天的用餐和游览，白天看景、晚间慢逛。点击地点查看游玩方法与出发准备。`,
        tips: ['每日安排为行程建议，请按当天开放时间、预约和实际交通确认顺序。', '住宿与城际交通未包含在地点费用中；未确认费用不代表免费。', ...anchor.tips],
      })
    }
  }
  return results
}

import { getReplacementCandidates, type GeneratedPlan } from './planner'
import { foodCompatibilityIssues, emptyDietaryProfile } from './dietary'
import { factsFor } from './verifiedFacts'
import { restaurantSourcesFor } from './researched-place-specs'
import { experienceAdvice, reviewedExperienceAdvice } from './experiencePolicy'

export type GuideSection = { id: string; title: string; state: 'estimated' | 'unknown' | 'not_applicable'; lines: string[]; sources: string[] }
export type TravelGuide = { tripId: string; revision: number; sections: GuideSection[]; knownSources: number; unknownStops: number; executable: boolean }
const titles = ['需求与适用人群','总体旅行策略','到达与离开','每日概要','每站体验','时间与衔接','餐饮全覆盖','住宿与寄存','交通策略','门票与预约','完整预算','天气与季节','人群适配','行前行动清单','Plan B','游览提醒与礼仪','购买、拍照与兴趣体验','同行决策','变更与不确定性','保存、随身与行后']

export function buildTravelGuide(plan: GeneratedPlan): TravelGuide {
  const experience = experienceAdvice(plan.intent, plan.id === 'easy' ? 'easy' : plan.id === 'rich' ? 'rich' : 'match')
  const stops=Object.values(plan.days).flat()
  const reviewedAdvice = Object.values(plan.days).flatMap(day=>reviewedExperienceAdvice(plan.city,day.map(stop=>stop.name),plan.intent.unavailablePlaces))
  const evidenceFor=(name:string)=>plan.knowledge.items.find(item=>item.name===name)
  const sources=stops.map(stop=>evidenceFor(stop.name)?.source.url).filter((url):url is string=>Boolean(url && /^https?:\/\//.test(url)))
  const currentFacts=stops.flatMap(stop=>factsFor(plan.city,stop.name,stop.date??plan.dates?.start).map(fact=>({name:stop.name,...fact})))
  const sourceList=[...new Set([...sources,...currentFacts.map(fact=>fact.sourceUrl),...stops.flatMap(stop=>restaurantSourcesFor(plan.city,stop.name).map(source=>source.url))])]
  const dishHints = plan.knowledge.items.filter(item => item.tags.includes('菜品线索') && !plan.knowledge.items.some(venue=>venue.venueName && venue.menuHighlights?.includes(item.name)) && foodCompatibilityIssues(`${item.name} ${item.summary}`, plan.intent.dietary ?? emptyDietaryProfile(), item.dietaryTags).length === 0).slice(0, 5).map(item => item.name)
  const diet=plan.intent.dietary
  const mealGaps=Object.entries(plan.days).flatMap(([day,items])=>['午餐','晚餐'].filter(meal=>!items.some(stop=>stop.type.includes(meal)&&!stop.pendingVenue)).map(meal=>`${day} ${meal}未安排具体餐厅；已预留或仍需补充用餐时间，费用待确认。`))
  const facts:string[][]=[
    [`${plan.city}，${plan.dates?`${plan.dates.start}至${plan.dates.end}`:'日期待确认'}，${plan.partySize}人，${plan.nights}晚。`, `全员预算上限：${plan.budgetLimit===null?'待确认':`¥${plan.budgetLimit}`}；${plan.intent.budgetScope}。`, `用户明确指定：${plan.intent.mustVisit.join('、')||'无'}。`, `偏好：${plan.intent.preferences.join('、')||'尚未提供'}；待确认：${plan.intent.missing.join('、')||'无'}。`],
    [plan.difference,`本方案节奏：${plan.pace}；片区顺序：${[...new Set(stops.map(stop=>stop.zone))].join(' → ')}。`,`优先保留：${plan.intent.mustVisit.join('、')||'到离时段、必要用餐与休息'}；其他体验可编辑。`],
    [`到达：${plan.intent.arrivalLocation??'地点待确认'} ${plan.intent.arrivalTime??'时间待确认'}。`,`返程：${plan.intent.departureLocation??'地点待确认'} ${plan.intent.departureTime??'时间待确认'}。`,'取行李、寄存及进站缓冲需按实际车站和订单确认；未查询车次或订单状态。'],
    Object.entries(plan.days).map(([day,items])=>`${day}：${items.map(stop=>`${stop.time} ${stop.name}`).join(' → ')}。`),
    stops.map(stop=>`${stop.name}：${stop.note} 建议停留${stop.durationMinutes}分钟；地址：${stop.address??'待确认'}。`),
    stops.map(stop=>`${stop.name} ${stop.time}开始，停留${stop.durationMinutes}分钟；上一站转场${stop.travelFromPreviousMinutes}分钟（规划假设，未取得实时道路依据）。`),
    [...stops.filter(stop=>/早餐|午餐|晚餐|小吃/.test(stop.type)).map(stop=>`${stop.name}：${stop.time}，${stop.priceState==='unknown'?'费用未知，未计入合计':`参考¥${stop.budget}/人`}，具体餐期与分店营业待确认。`),...mealGaps,'早餐是否已含酒店或车上解决：待确认；过敏用户需向餐厅确认配料和交叉接触。'],
    plan.nights>0?[`建议片区：${plan.intent.hotel??stops.find(stop=>stop.type==='住宿')?.zone??'待确认'}。`,`住宿估算¥${plan.budgetBreakdown.lodging}，${plan.intent.roomCount??Math.ceil(plan.partySize/2)}间 × ${plan.nights}晚（${plan.intent.roomCount?'使用指定房间数':'默认每间2人，可另行调整'}）。`,'酒店入住、退房与寄存政策尚未核实；推荐不代表房态或预订成功。']:['本次不含住宿；如需寄存请先确认服务点和营业时间。'],
    ['内部展示站点顺序，不是道路地图。使用单站或当前站到下一站的外部地图确认路线。',...stops.filter(stop=>stop.travelFromPreviousMinutes>0).map(stop=>`${stop.name}：${stop.transport}；来源为规划假设，不能视为道路实测。`)],
    stops.filter(stop=>/景点|展览|园林/.test(stop.type)).flatMap(stop=>{
      const facts=factsFor(plan.city,stop.name,stop.date??plan.dates?.start).filter(fact=>['opening','booking','price','exhibition'].includes(fact.field))
      return facts.length?facts.map(fact=>`${stop.name}：${fact.value} [${fact.state}，查阅${fact.fetchedAt}${fact.appliesFrom?`，适用${fact.appliesFrom}至${fact.appliesTo}`:''}] 当前未预订。`):[`${stop.name}：${stop.priceState==='unknown'?'费用待确认，未计入合计':`参考费用¥${stop.budget}/人`}，项目范围、预约窗口、最晚入场待核对；当前未预订。`]
    }),
    [`已计入的全员本地计划估算¥${plan.budget}，含风险预留¥${plan.budgetBreakdown.buffer}，不代表报价。`,...Object.entries(plan.budgetBreakdown).filter(([key])=>key!=='total').map(([key,value])=>`${({lodging:'住宿',meals:'餐饮',transport:'市内交通',tickets:'门票',coffee:'咖啡',buffer:'风险预留'} as Record<string,string>)[key]}：¥${value}`),...stops.filter(stop=>stop.priceState==='unknown').map(stop=>`${stop.name}费用未知，尚未计入数值合计，不是免费。`),'往返车票、未安排餐次及未核实价格是待确认项，不是免费。实际记账独立于计划预算。'],
    ['尚未查询适用出行日期的天气预报，不显示精确晴雨温度。临近出行再查供应商覆盖范围内预报；超出范围仅作季节准备。'],
    [`节奏${plan.pace}；${plan.intent.constraints.join('；')||'尚未提供体力或同行人特殊条件'}。`,`饮食限制：${diet?.allergies.length?`过敏 ${diet.allergies.join('、')}`:'未提供过敏信息'}${diet?.avoidSpicy?'，不吃辣':''}${diet?.vegetarian?'，素食':''}。`,'无障碍、电梯、儿童设施尚无核实信息，不能承诺可达。'],
    ['先确认到离站和日期，再核对每个场馆预约及用餐安排。','保存凭证，确认住宿房晚和寄存，按行程工具中的独立清单逐项勾选。','当前只提供站内待办；未开通后台推送通知。'],
    ['下雨、闭馆或约满：先取消可选户外/场馆活动，保留用餐、休息和返程；新地点通过“替换”重新校验。','迟到、疲劳：删除未完成可选站点，已完成记录和固定预订保持。','预算不足：减少可选体验或修改条件，不能自动降低相同项目价格。',`当前约束问题：${plan.validation.issues.join('；')||'算术检查未发现冲突；动态事实仍待核对'}。`],
    ['预约与入口信息以场馆当日公告为准；具体场馆规则尚未逐项查询。','夜间结束前确认返程方式；不要把陌生地点的免费、开放或安全性当作已核实事实。'],
    plan.intent.preferences.some(x=>/拍照|摄影|购物|咖啡/.test(x))?[`兴趣匹配：${stops.filter(stop=>/咖啡|购物|拍照/.test(`${stop.type}${stop.note}`)).map(stop=>stop.name).join('、')||'候选不足，需要补充资料'}。`,'没有来源的摄影机位或购物点不做具体承诺。']:['未提出购买或摄影需求，不额外加入购物行程。'],
    plan.partySize>1?[`计价人数${plan.partySize}，不代表已有${plan.partySize}名真实成员。`,'通过邀请加入后填写偏好并投票；过敏、预算和可用时间先作为硬限制。未加入的人不计入投票。']:['单人行程，无需邀请或投票。'],
    [`本版revision ${plan.revision??1}；${sourceList.length}个不同来源链接，${stops.filter(stop=>!evidenceFor(stop.name)?.source.url).length}站缺来源。`,`已收录官方字段${currentFacts.filter(fact=>fact.state==='verified').length}项，待确认或冲突${currentFacts.filter(fact=>fact.state!=='verified').length}项；查阅日期见门票与预约，存在链接不等于已核实全部票价、营业或交通。`,...plan.validation.issues],
    ['明确保存后可从行程、我的及行程工具打开同一Trip。当前本地保存不等于云同步。','打开外部地图不会写到达记录；实际到达或完成需要手动确认。','可导出完整Markdown，实际支出和手动访问独立记录。']
  ]
  facts[1].unshift(experience.strategy)
  facts[1].push(...reviewedAdvice.map(item=>item.summary))
  for (const url of reviewedAdvice.flatMap(item=>item.sources)) if (!sourceList.includes(url)) sourceList.push(url)
  facts[6].unshift(experience.meal)
  facts[12].unshift(...experience.scenario)
  facts[14].unshift(...experience.planB)
  facts[13].unshift(experience.notice)
  if (dishHints.length) facts[6].push(`当地菜品研究线索：${dishHints.join('、')}；尚未匹配具体门店，不能作为已安排餐厅；点单前按同行人的配料与过敏要求筛选。`)
  if (plan.intent.unavailablePlaces?.length) facts[0].push(`用户排除或不可用：${plan.intent.unavailablePlaces.join('、')}；生成和替换沿用此条件。`)
  const choices = stops.filter(stop => !stop.fixed && !plan.execution?.some(event => event.stopId === stop.id && event.action === 'completed')).map(stop => ({stop, candidates: getReplacementCandidates(plan, stop.id).slice(0, 3)})).filter(item => item.candidates.length)
  facts[14].push(...choices.map(({stop, candidates}) => `${stop.name}可选：${candidates.map(candidate => `${candidate.name}（${candidate.meta}；${candidate.reason}）`).join('；')}。${plan.intent.mustVisit.some(name => stop.name.includes(name)) ? '原站为必去地点，替换会重新检查必去覆盖。' : ''}`))
  if (plan.intent.alternatives?.length) facts[13].unshift(...plan.intent.alternatives.map(item => `${item.unavailable}不可用 → ${item.replacement}：${item.reason} 来源：${item.sourceUrl}`))
  if (plan.sourceGroup) facts[17] = [`共同计划 ${plan.sourceGroup.planId} / 决定版本 ${plan.sourceGroup.revision}；${plan.sourceGroup.needsDecision ? '原决定失效，需重新投票' : '已应用真实成员投票结果'}。`, `共同偏好：${plan.intent.preferences.join('、')}。`, '成员饮食限制更新后重新校验；本机保存版本可离线查看，联网后同步。']
  return {tripId:plan.tripId??`draft-${plan.id}`,revision:plan.revision??1,knownSources:sources.length,unknownStops:stops.length-sources.length,executable:plan.validation.passed && plan.intent.missing.length===0 && stops.every(stop=>stop.factState==='verified'),sections:titles.map((title,index)=>({id:`G-${String(index+1).padStart(2,'0')}`,title,state:index===11?'unknown':(index===7 && !plan.nights)||(index===17 && plan.partySize===1)?'not_applicable':'estimated',lines:facts[index].length?facts[index]:['当前无适用项目，需按实际需求补充。'],sources:[3,4,9,18].includes(index)?sourceList:[]}))}
}

export function guideMarkdown(plan: GeneratedPlan) {
  const guide=buildTravelGuide(plan)
  return `# ${plan.city}旅行路书\n\nTrip ${guide.tripId} / revision ${guide.revision}\n\n${guide.executable?'算术校验通过，出发前仍需核对动态信息。':'待确认方案：尚不满足可执行门槛。'}\n\n`+guide.sections.map(section=>`## ${section.id} ${section.title}\n\n${section.lines.map(line=>`- ${line}`).join('\n')}\n\n${section.sources.map(url=>`来源：${url}`).join('\n')}`).join('\n\n')
}

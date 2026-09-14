import { isRuntimeCityAllowed } from './runtimeKnowledgePolicy'

export type TravelFact = {
  field: 'address' | 'opening' | 'booking' | 'price' | 'exhibition'
  state: 'verified' | 'estimated' | 'unknown' | 'conflict' | 'stale'
  value: string
  sourceUrl: string
  fetchedAt: string
  appliesFrom?: string
  appliesTo?: string
}
const checked='2026-09-05'
const fact=(field:TravelFact['field'],value:string,sourceUrl:string,extra:Partial<TravelFact>={}):TravelFact=>({field,value,sourceUrl,state:'verified',fetchedAt:checked,...extra})
// Field-level findings from the official pages read during the PRD implementation.
// These do not verify coordinates, ticket stock, weather, or a future booking.
export const checkedTravelFacts:Record<string,TravelFact[]>={
 '郑州/河南博物院':[
  fact('address','郑州市农业路8号；官方列出地铁2号线关虎屯站、7号线农业大学站，出口与步行路线另查地图。','https://www.chnmus.net/ch/service/index.html?active=1',{fetchedAt:'2026-09-06'}),
  fact('opening','当前服务页为周二至周日09:00—20:30，19:30停止入馆；周一闭馆，法定节假日例外。延长时段出发前复核，不外推全年。','https://www.chnmus.net/ch/service/index.html?active=1',{fetchedAt:'2026-09-06'}),
  fact('booking','散客通过官方公众号或智慧导览小程序实名预约，按预约时段携证件入馆；官网团队通道不适用于个人。','https://www.chnmus.net/ch/service/index.html?active=1',{fetchedAt:'2026-09-06'}),
  fact('booking','同页延长时段放票出现14时和16时两种说明，放票时间需向官方确认，不能据此保证约到。','https://www.chnmus.net/ch/service/index.html?active=1',{state:'conflict',fetchedAt:'2026-09-06'}),
  fact('price','实行实名预约免费参观；人工讲解等自选服务另收费，不计作全程免费。','https://www.chnmus.net/ch/service/index.html?active=1',{fetchedAt:'2026-09-06'}),
  fact('exhibition','可按中原古代文明、青铜器或明清珍宝选择主题；轮椅和婴儿车可到服务台凭证件及押金办理当日使用。','https://www.chnmus.net/ch/service/index.html?active=1',{fetchedAt:'2026-09-06'}),
 ],
 '兰州/甘肃省博物馆':[
  fact('opening','官方参观须知：09:00开馆，16:30停止入馆，17:00闭馆；周一闭馆，节假日例外另核对。','https://www.gansumuseum.com/about?nav=8-0',{fetchedAt:'2026-09-06'}),
  fact('booking','免费预约参观，官网提供个人扫码和团队入口；公告页列16:00结束预约，不代表当前有余票。','https://www.gansumuseum.com/about?nav=8-0',{fetchedAt:'2026-09-06'}),
  fact('address','地铁1号线西站什字站A口向东约500米；这是官方站点接驳说明，完整行程转场仍需地图核对。','https://www.gansumuseum.com/about?nav=8-0',{fetchedAt:'2026-09-06'}),
 ],
 '宁波/包玉刚故居':[
  fact('address','宁波市镇海区后包巷。','https://www.nbmuseum.cn/col/col20979/index.html',{fetchedAt:'2026-09-06'}),
  fact('opening','09:00—17:00，16:00停止入馆；周一闭馆，国家法定节假日正常开放；台风等特殊情况以公告为准。','https://www.nbmuseum.cn/col/col20979/index.html',{fetchedAt:'2026-09-06'}),
  fact('price','故居免费开放；此说明不涵盖交通及餐饮。','https://www.nbmuseum.cn/col/col20979/index.html',{fetchedAt:'2026-09-06'}),
  fact('booking','当前参观指南未说明个人是否需预约，出发前联系0574-56585011确认。','https://www.nbmuseum.cn/col/col20979/index.html',{state:'unknown',fetchedAt:'2026-09-06'}),
 ],
 '合肥/安徽博物院':[
  fact('address','蜀山馆（新馆）：合肥市怀宁路87号；庐阳馆（老馆）在安庆路268号，请区分馆区。','https://www.ahm.cn/',{fetchedAt:'2026-09-06'}),
  fact('opening','官网常规开放09:00—17:00，16:30停止入馆；蜀山馆周一闭馆、庐阳馆周二闭馆，节假日另行通知。','https://www.ahm.cn/',{fetchedAt:'2026-09-06'}),
  fact('booking','旧免预约答复与后续周末预约线索不一致，本轮未取得最新官方公告全文，出行日期对应预约规则待确认。','https://www.ahm.cn/',{state:'unknown',fetchedAt:'2026-09-06'}),
 ],
 '成都/金沙遗址博物馆':[
  fact('address','成都市青羊区金沙遗址路2号。','https://www.jinshasitemuseum.com/',{fetchedAt:'2026-09-06'}),
  fact('opening','官网公告：2025年12月5日至2027年4月30日闭馆，此区间不能安排入馆参观。','https://www.jinshasitemuseum.com/',{fetchedAt:'2026-09-06',appliesFrom:'2025-12-05',appliesTo:'2027-04-30'}),
 ],
 '南京/江苏省美术馆':[
  fact('address','南京市长江路333号。','https://www.jssmsg.cn/'),
  fact('opening','周二至周日09:00—17:00，16:30停止入馆；周一闭馆，法定节假日另核对。','https://www.jssmsg.cn/'),
  fact('booking','散客无需预约，携身份证或社保卡等有效证件刷卡入馆；团队仍需致电025-89610810预约。','https://www.jssmsg.cn/'),
  fact('price','参观须知未列当期特展收费，出发前核对；不代表已购买门票。','https://www.jssmsg.cn/',{state:'unknown'}),
 ],
 '南京/南京博物院':[
  fact('address','南京市中山东路321号','https://activity.njmuseum.com.cn/reservation/home.jsp'),
  fact('booking','通过官方预约入口，未满14周岁（含14周岁）需由成年人预约亲子票；每位成年人最多带3名未成年人。','https://activity.njmuseum.com.cn/reservation/home.jsp'),
  fact('price','本轮能访问的官方预约页未列票价，原静态金额不作为已核实门票报价。','https://ticket.njmuseum.com.cn/reservation/userOut/outSingle/toSingleIndex.do',{state:'unknown'}),
 ],
 '上海/上海博物馆东馆':[
  fact('address','上海市浦东新区世纪大道1952号，散客从B1层东门入馆。','https://www.shanghaimuseum.cn/mu/frontend/pg/service/visit-east'),
  fact('opening','10:00—18:00，17:00停止入场；周二闭馆，国定节假日例外需确认。','https://www.shanghaimuseum.cn/mu/frontend/pg/service/visit-east'),
  fact('booking','散客基本陈列免预约；数字馆、探索宫等互动空间需专项预约，收费特展另行购票。','https://www.shanghaimuseum.cn/mu/frontend/pg/service/visit-east'),
 ],
 '上海/上海博物馆（人民广场馆）':[
  fact('address','上海市黄浦区人民大道201号，武胜路南门。','https://www.shanghaimuseum.cn/mu/frontend/pg/en/service/visit-west'),
  fact('opening','常规日场09:00—17:00，15:00停止入场；周一闭馆，国定节假日例外需确认。','https://www.shanghaimuseum.cn/mu/frontend/pg/en/service/visit-west'),
  fact('exhibition','“世界树之巅”展期内人民广场馆不展出其他展览，常设展请前往东馆。','https://www.shanghaimuseum.cn/mu/frontend/pg/en/service/visit-west',{appliesFrom:'2026-07-09',appliesTo:'2027-11-14'}),
  fact('booking','本期特展需预约购票；首页基本陈列说明不适用于该特展。价格与剩余票量需进入官方票务核实。','https://www.shanghaimuseum.cn/mu/frontend/pg/index',{appliesFrom:'2026-07-09',appliesTo:'2027-11-14'}),
 ],


}

export function factsFor(city:string,name:string,date?:string) {
 if(!isRuntimeCityAllowed(city))return []
 return (checkedTravelFacts[`${city}/${name}`]??[]).filter(item=>!date || (!item.appliesFrom || date>=item.appliesFrom)&&(!item.appliesTo || date<=item.appliesTo))
}

// These two source pages were read on 2026-09-05. Only the published 2026
// National Day range is applied; no future-year holiday is extrapolated.
export function verifiedOpeningForDate(city:string,name:string,date?:string) {
 if(city!=='上海'||!date||!date.startsWith('2026-'))return undefined
 const west=name==='上海博物馆（人民广场馆）',east=name==='上海博物馆东馆'
 if(!west&&!east)return undefined
 const nationalDay=date>='2026-10-01'&&date<='2026-10-07'
 return {from:west?'09:00':'10:00',to:west?'17:00':'18:00',lastAdmission:west?'15:00':'17:00',closedWeekdays:nationalDay?[]:[west?1:2],label:`上博官方日场规则；${nationalDay?'按2026国庆放假范围适用节假日例外，临时公告和预约余票待确认':'常规闭馆日适用'}。`}
}

/** A dated closure is a scheduling constraint, not merely a detail-page note. */
export function isOfficiallyClosed(city: string, name: string, dates?: {start: string; end: string} | null) {
  if (!dates) return false
  return city === '成都' && /金沙遗址/.test(name) && dates.start <= '2027-04-30' && dates.end >= '2025-12-05'
}

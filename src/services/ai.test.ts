import { afterEach, describe, expect, test, vi } from 'vitest'
import { PlanningAIAdapter } from './ai'
import { understandTrip } from './trip/planner'

const remoteUnderstanding = {
  intent: {
    destination: '上海',
    dates: null,
    durationDays: 3,
    nights: 2,
    partySize: 2,
    budget: 4000,
    budgetScope: '总预算',
    pace: 'relaxed' as const,
    mustVisit: ['外滩'],
    preferences: [],
    constraints: [],
    arrivalTime: null,
    arrivalLocation: null,
    departureTime: null,
    departureLocation: null,
    hotel: null,
    missing: ['具体出行日期'],
  },
  evidence: ['测试响应'],
  summary: '上海 · 3天2晚 · 2人 · 松弛',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PlanningAIAdapter remote requests', () => {
  test('first generated Hohhot results include restaurants before reporting success',async()=>{
    const adapter=new PlanningAIAdapter({remoteAIEnabled:false,apiBase:''})
    const stages:string[]=[]
    const options=await adapter.generatePlans(understandTrip({text:'呼和浩特3天',media:[]}),stage=>stages.push(stage))
    expect(options).toHaveLength(3)
    expect(options.every(plan=>Object.values(plan.days).flat().filter(stop=>/早餐|午餐|晚餐/.test(stop.type)).length===9)).toBe(true)
    expect(options.flatMap(plan=>Object.values(plan.days).flat()).some(stop=>/餐/.test(stop.type)&&stop.pendingVenue)).toBe(false)
    expect(stages.at(-1)).toBe('success')
  })
  test('insufficient restaurant evidence never becomes a successful incomplete itinerary',async()=>{
    const adapter=new PlanningAIAdapter({remoteAIEnabled:false,apiBase:''})
    const stages:string[]=[]
    await expect(adapter.generatePlans(understandTrip({text:'稻城亚丁3天',media:[]}),stage=>stages.push(stage))).rejects.toThrow('攻略未生成完成')
    expect(stages).not.toContain('success')
  })
  test('retains explicit experience preferences when an older server omits them', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...remoteUnderstanding,intent:{...remoteUnderstanding.intent,pace:'balanced',preferences:[]}})})))
    const adapter=new PlanningAIAdapter({remoteAIEnabled:true,apiBase:'http://test.local'})
    const result=await adapter.understandTrip({text:'上海3天，情侣，第一次去，睡到自然醒，不想太累，预算4000',media:[]},()=>{})
    expect(result.intent.preferences).toEqual(expect.arrayContaining(['情侣','第一次','晚起']))
    expect(result.intent.pace).toBe('relaxed')
  })
  test('cancellation aborts the HTTP request without falling back to local success', async () => {
    const stages:string[]=[]
    const fetchMock=vi.fn((_url:string,options?:RequestInit)=>new Promise((_resolve,reject)=>{
      options?.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true})
    }))
    vi.stubGlobal('fetch',fetchMock)
    const adapter=new PlanningAIAdapter({remoteAIEnabled:true,apiBase:'http://test.local'})
    const controller=new AbortController()
    const running=adapter.understandTrip({text:'南京3天预算4000元。',media:[]},stage=>stages.push(stage),controller.signal)
    controller.abort()
    await expect(running).rejects.toMatchObject({name:'AbortError'})
    expect(stages).not.toContain('success')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('deduplicates identical concurrent understanding requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => remoteUnderstanding,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })
    const request = { text: '上海三天，两个人，预算4000元。', media: [] }

    const first = adapter.understandTrip(request, () => {})
    const second = adapter.understandTrip(request, () => {})
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(firstResult).toEqual(remoteUnderstanding)
    expect(secondResult).toEqual(remoteUnderstanding)
  })

  test('rejects empty provider fields without silently returning a local plan', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...remoteUnderstanding,
        intent: {
          ...remoteUnderstanding.intent,
          destination: '未确定',
          dates: null,
          budget: null,
          mustVisit: [],
          preferences: [],
          arrivalTime: null,
          arrivalLocation: null,
          departureTime: null,
          departureLocation: null,
          hotel: null,
          missing: ['具体出行日期', '到达时间和地点', '返程时间和地点', '酒店位置', '总预算'],
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })
    const onStage = vi.fn()
    await expect(adapter.understandTrip({ text: '上海三天，两个人，预算4000元。', media: [] }, onStage)).rejects.toMatchObject({code:'INVALID_RESPONSE'})
    expect(onStage.mock.calls.some(([stage])=>stage==='success')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('reads image facts before sending the trip to text understanding', async () => {
    const mediaFacts = [{
      mediaId: 'ticket-1',
      name: '车票.png',
      kind: 'ticket' as const,
      rawText: '上海虹桥 10:30',
      facts: {
        dates: null,
        times: ['10:30'],
        locations: ['上海虹桥'],
        arrivalLocation: '虹桥火车站',
        departureLocation: null,
        hotel: null,
        placeNames: [],
        budget: null,
        notes: [],
      },
      confidence: 0.94,
      needsConfirmation: false,
      warnings: [],
      provider: 'zhipu',
    }]
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/api/trips/media/analyze')) {
        const body = JSON.parse(String(options?.body)) as { media: Array<{ dataUrl: string }> }
        expect(body.media[0].dataUrl).toBe('data:image/png;base64,AA==')
        return { ok: true, json: async () => ({ mediaFacts, provider: 'zhipu', warnings: [] }) }
      }
      return { ok: true, json: async () => ({ ...remoteUnderstanding, mediaFacts }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })

    const result = await adapter.understandTrip({
      text: '上海三天，两个人，预算4000元。',
      media: [{ id: 'ticket-1', src: 'data:image/png;base64,AA==', name: '车票.png', category: '票据' }],
    }, () => {})

    expect(result.mediaFacts?.[0].facts.arrivalLocation).toBe('虹桥火车站')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const understandingCall = fetchMock.mock.calls[1]
    const understandingBody = JSON.parse(String(understandingCall[1]?.body)) as { mediaFacts?: typeof mediaFacts }
    expect(understandingBody.mediaFacts?.[0].mediaId).toBe('ticket-1')
  })
})


describe('screenshot reading independent of text provider', () => {
  test('sends image bytes even when remote text is disabled and retains failed recognition', async () => {
    const fetchMock=vi.fn(async(_url:string,_options?:RequestInit)=>{throw new Error('offline')})
    vi.stubGlobal('fetch',fetchMock)
    const result=await new PlanningAIAdapter({remoteAIEnabled:false,apiBase:'http://test.local'}).understandTrip({text:'杭州三天',media:[{id:'image-1',name:'photo.png',src:'data:image/png;base64,aGVsbG8='}]},()=>{})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://test.local/api/trips/media/analyze')
    expect(result.mediaFacts?.[0]).toMatchObject({mediaId:'image-1',needsConfirmation:true,confidence:0})
  })
})

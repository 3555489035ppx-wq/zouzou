import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIService } from '../ai'
import { TripGenerationJob, readGenerationJob } from './generationJob'
import { generatePlans, understandTrip } from './planner'

afterEach(()=>vi.unstubAllGlobals())
const request={text:'2026年9月18日去南京1天，预算2000元。',media:[]}
function setup() {
  const local=new Map<string,string>(),session=new Map<string,string>()
  const storage=(values:Map<string,string>)=>({getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)})
  vi.stubGlobal('window',{localStorage:storage(local),sessionStorage:storage(session)})
  const result=understandTrip(request)
  const service={understandTrip:vi.fn(async()=>result),generatePlans:vi.fn(async()=>generatePlans(result.intent))} as unknown as AIService
  return {service,result,local,session}
}
describe('persistent generation jobs',()=>{
  it('regenerates old planner results instead of resuming stale restaurant placeholders',async()=>{
    const {service}=setup()
    const job=new TripGenerationJob(request,service)
    await job.understand(()=>{})
    await job.plan(()=>{})
    job.record.plans=job.record.plans!.map(plan=>({...plan,plannerContentVersion:undefined}))
    await job.plan(()=>{})
    expect(service.generatePlans).toHaveBeenCalledTimes(2)
  })
  it('reload keeps identity and completed understanding; failed planning retries only planning',async()=>{
    const {service}=setup()
    const first=new TripGenerationJob(request,service)
    await first.understand(()=>{})
    vi.mocked(service.generatePlans).mockRejectedValueOnce(Error('排程失败'))
    await expect(first.plan(()=>{})).rejects.toThrow('排程失败')
    expect(readGenerationJob()?.status).toBe('failed')
    const resumed=new TripGenerationJob(request,service)
    expect(resumed.record.id).toBe(first.record.id)
    await resumed.understand(()=>{})
    await resumed.plan(()=>{})
    expect(service.understandTrip).toHaveBeenCalledTimes(1)
    expect(service.generatePlans).toHaveBeenCalledTimes(2)
    expect(readGenerationJob()?.status).toBe('complete')
  })
  it('cancellation aborts the provider and a late result cannot mark the job complete',async()=>{
    const {service,result}=setup()
    let finish!:(value:typeof result)=>void
    let signal:AbortSignal|undefined
    vi.mocked(service.understandTrip).mockImplementation((_request,_listener,nextSignal)=>{
      signal=nextSignal
      return new Promise(resolve=>{finish=resolve})
    })
    const job=new TripGenerationJob(request,service)
    const running=job.understand(()=>{})
    job.cancel()
    expect(signal?.aborted).toBe(true)
    finish(result)
    await expect(running).rejects.toMatchObject({name:'AbortError'})
    expect(readGenerationJob()?.status).toBe('cancelled')
    expect(readGenerationJob()?.understanding).toBeUndefined()
  })
  it('new input gets a new identity, while storage failure prevents claiming success',async()=>{
    const {service}=setup()
    const first=new TripGenerationJob(request,service)
    await first.understand(()=>{})
    const next=new TripGenerationJob({...request,text:'去上海1天，预算2000元。'},service)
    expect(next.record.id).not.toBe(first.record.id)
    vi.stubGlobal('window',{localStorage:{getItem:()=>null,setItem:()=>{throw Error('quota')}},sessionStorage:{getItem:()=>null,setItem:()=>{throw Error('quota')}}})
    await expect(first.plan(()=>{})).rejects.toThrow('保存失败')
    expect(service.generatePlans).not.toHaveBeenCalled()
  })
})

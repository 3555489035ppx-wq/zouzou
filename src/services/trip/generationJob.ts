import type { AIService, StageListener } from '../ai'
import { readVersioned, writeVersioned } from '../storage'
import { completePlanOptions, PLANNER_CONTENT_VERSION, TRIP_PLANS_STORAGE, type GeneratedPlan, type TripRequest, type TripUnderstanding } from './planner'

export const GENERATION_JOB_KEY = 'zouzou-generation-job-v1'
export type GenerationJob = {
  draftRevision?: number
  id: string
  inputKey: string
  text: string
  phase: 'understanding' | 'confirmation' | 'planning' | 'complete'
  status: 'running' | 'waiting' | 'failed' | 'cancelled' | 'interrupted' | 'complete'
  label: string
  updatedAt: string
  understanding?: TripUnderstanding
  plans?: GeneratedPlan[]
  error?: string
}

export function readGenerationJob() { return readVersioned<GenerationJob>(GENERATION_JOB_KEY, 'local') }

// One current job, matching the existing single draft. Images stay in the
// draft store; the job references their IDs instead of duplicating data URLs.
export class TripGenerationJob {
  record: GenerationJob
  private controller?: AbortController
  private understandingWork?: Promise<TripUnderstanding>
  private planningWork?: Promise<GeneratedPlan[]>
  constructor(private request: TripRequest, private service: AIService) {
    const meta=readVersioned<{draftId:string;draftRevision:number}>('zouzou-generation-input-meta','session')
    const inputKey=JSON.stringify({text:request.text,media:request.media.map(({id,name})=>({id,name})),meta})
    const previous=readGenerationJob()
    this.record=previous?.inputKey===inputKey ? previous : {
      id:crypto.randomUUID(),inputKey,text:request.text,draftRevision:meta?.draftRevision,phase:'understanding',status:'waiting',label:'准备理解需求',updatedAt:new Date().toISOString(),
    }
  }
  private save(patch: Partial<GenerationJob>) {
    const current = readGenerationJob()
    if (current && current.id !== this.record.id && this.controller) throw new DOMException('新草稿已开始，旧请求结果已忽略', 'AbortError')
    const next={...this.record,...patch,updatedAt:new Date().toISOString()}
    if(!writeVersioned(GENERATION_JOB_KEY,next,'local'))throw new Error('生成进度保存失败，请释放本机空间后重试；原草稿保留。')
    this.record=next
  }
  cancel(interrupted=false) {
    if(this.record.status!=='running')return
    this.controller?.abort()
    this.save({status:interrupted?'interrupted':'cancelled',label:interrupted?'任务中断，可从已完成阶段继续':'任务已取消，可继续此任务'})
  }
  updateUnderstanding(understanding:TripUnderstanding) {
    this.save({understanding,plans:undefined,phase:'confirmation',status:'waiting',error:undefined})
  }
  async understand(onStage:StageListener) {
    if(this.record.understanding)return this.record.understanding
    if(this.understandingWork)return this.understandingWork
    this.understandingWork=this.run('understanding',onStage,async(signal,listener)=>{
      const understanding=await this.service.understandTrip(this.request,listener,signal)
      signal.throwIfAborted()
      this.save({understanding,phase:'confirmation',status:'waiting',label:'理解已保存，请确认条件'})
      return understanding
    }).finally(()=>{this.understandingWork=undefined})
    return this.understandingWork
  }
  async plan(onStage:StageListener) {
    if(!this.record.understanding)throw new Error('请先完成需求理解。')
    if(this.record.understanding.intent.conflicts.length)throw new Error('请先解决条件冲突，再生成方案。')
    if(this.planningWork)return this.planningWork
    this.planningWork=this.run('planning',onStage,async(signal,listener)=>{
      const meta=readVersioned<{example?:boolean}>('zouzou-generation-input-meta','session')
      const reusable=this.record.plans?.every(plan=>plan.plannerContentVersion===PLANNER_CONTENT_VERSION)?this.record.plans:undefined
      const plans=completePlanOptions(reusable??(await this.service.generatePlans(this.record.understanding!,listener,signal)).map(plan=>({...plan,generationId:this.record.id,draftRevision:this.record.draftRevision,example:meta?.example??false})))
      signal.throwIfAborted()
      // Retain completed generation if writing the session result fails.
      this.save({plans})
      if(!writeVersioned(TRIP_PLANS_STORAGE,plans,'session'))throw new Error('方案已生成，但结果页存储失败。释放空间后可重试保存，无需重新生成。')
      this.save({phase:'complete',status:'complete',label:'方案已生成并保存，可查看结果'})
      if(typeof window!=='undefined')window.dispatchEvent?.(new Event('zouzou-options-updated'))
      return plans
    }).finally(()=>{this.planningWork=undefined})
    return this.planningWork
  }
  private async run<T>(phase:'understanding'|'planning',onStage:StageListener,work:(signal:AbortSignal,listener:StageListener)=>Promise<T>) {
    if(this.controller && !this.controller.signal.aborted && this.record.status==='running')throw new Error('当前阶段仍在运行，请等待或取消。')
    const controller=new AbortController()
    this.save({phase,status:'running',error:undefined})
    this.controller=controller
    try {
      return await work(controller.signal,(stage,label)=>{
        controller.signal.throwIfAborted()
        this.save({label})
        onStage(stage,label)
      })
    } catch(error) {
      if(!controller.signal.aborted && readGenerationJob()?.id===this.record.id)this.save({status:'failed',error:error instanceof Error?error.message:String(error)})
      throw error
    }
  }
}

let currentJob: TripGenerationJob | undefined
export function getTripGenerationJob(request:TripRequest,service:AIService) {
  const next=new TripGenerationJob(request,service)
  if(currentJob?.record.inputKey===next.record.inputKey)return currentJob
  currentJob?.cancel()
  currentJob=next
  return next
}

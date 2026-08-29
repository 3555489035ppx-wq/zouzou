import {
  generatePlans,
  replacePlanPlace,
  understandTrip,
  type GeneratedPlan,
  type TripRequest,
  type TripUnderstanding,
} from './trip/planner'

export type AIStage = 'listening' | 'reading' | 'thinking' | 'planning' | 'updating' | 'done' | 'success' | 'error'
export type StageListener = (stage: AIStage, label: string) => void

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export interface AIService {
  understandTrip(request: TripRequest, onStage: StageListener): Promise<TripUnderstanding>
  generatePlans(understanding: TripUnderstanding, onStage: StageListener): Promise<GeneratedPlan[]>
  replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener): Promise<GeneratedPlan>
  personalizeTrip(postId: string, mode: 'keep' | 'optimize'): Promise<{ tripId: string; mode: string }>
}

/**
 * Offline execution adapter for the prototype. It performs real parsing and
 * deterministic schedule validation against real Shanghai places, while
 * keeping the provider boundary ready for a server-backed AI adapter later.
 */
class LocalPlanningAIAdapter implements AIService {
  async understandTrip(request: TripRequest, onStage: StageListener) {
    if (!request.text.trim()) throw new Error('请先写下你的旅行想法。')
    onStage('listening', '正在提取日期、预算和必去地点')
    await wait(180)
    onStage('reading', `正在读取 ${request.media.length} 张截图线索`)
    await wait(180)
    const result = understandTrip(request)
    onStage('thinking', result.intent.missing.length > 0 ? '已识别需求，正在标记待确认信息' : '已识别需求和固定行程锚点')
    await wait(180)
    onStage('planning', '检查地点、时间窗口与预算')
    await wait(180)
    onStage('success', '理解完成')
    return result
  }

  async generatePlans(understanding: TripUnderstanding, onStage: StageListener) {
    for (const label of ['整理真实地点', '安排固定到达与返程', '计算片区移动', '校验营业时间', '平衡预算与缓冲']) {
      onStage('planning', label)
      await wait(140)
    }
    const result = generatePlans(understanding.intent)
    onStage('success', result.every((plan) => plan.validation.passed) ? '3 套可执行方案已准备好' : '方案已生成，还有信息需要确认')
    return result
  }

  async replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener) {
    onStage('updating', '理解这个地点在路线中的作用')
    await wait(180)
    onStage('updating', '重新检查前后路程与营业时间')
    await wait(180)
    const nextPlan = replacePlanPlace(plan, placeId, replacementName)
    onStage('success', nextPlan.validation.passed ? '已局部更新，路线仍然可执行' : '已更新，但需要重新确认行程条件')
    return nextPlan
  }

  async personalizeTrip(postId: string, mode: 'keep' | 'optimize') {
    await wait(220)
    return { tripId: `copy-${postId}`, mode }
  }
}

export const aiService: AIService = new LocalPlanningAIAdapter()

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ZouMotionBot } from './ui'
import { useAppStore } from '../stores/appStore'
import type { BotState } from '../character/engine/motionEngine'

const expressions: BotState[] = ['thinking', 'listening', 'thinking', 'listening']
export function UnderstandingBot({ busy, failed }: { busy: boolean; failed: boolean }) {
  const [beat, setBeat] = useState(0)
  const reduce = useAppStore(s => s.reducedMotion)
  const systemReduce = useReducedMotion()
  useEffect(() => {
    if (!busy || failed || reduce || systemReduce) return
    const timer = window.setInterval(() => setBeat(value => (value + 1) % expressions.length), 1200)
    return () => window.clearInterval(timer)
  }, [busy, failed, reduce, systemReduce])
  return <ZouMotionBot state={failed ? 'sad' : !busy ? 'happy' : reduce || systemReduce ? 'thinking' : expressions[beat]} label={failed ? '走走暂时遇到问题' : busy ? '走走正在思考旅行安排' : '走走已完成理解'} />
}

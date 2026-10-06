import { describe, expect, it } from 'vitest'
import { agentCopy, friendlyQuestion } from './travel-agent-copy'

describe('Chinese conversation copy', () => {
  it('removes boilerplate without changing the question', () => {
    expect(friendlyQuestion('作为AI助手，你准备玩几天？')).toBe('你准备玩几天？')
  })
  it('asks one question at a time', () => {
    expect(friendlyQuestion('想去哪个城市？准备玩几天？')).toBe('想去哪个城市？')
  })
  it('uses a short fallback rather than clipping a long model paragraph', () => {
    expect(friendlyQuestion('长'.repeat(200), agentCopy.askDuration)).toBe(agentCopy.askDuration)
  })
  it('does not demand a budget or promise real-world verification', () => {
    expect(agentCopy.budget).toContain('还没想好也没关系')
    expect(agentCopy.plan('上海', 2, 1, false)).not.toMatch(/保证|实时核实|完美/)
    expect(agentCopy.factualNotice).toContain('没有接入实时信息')
  })
  it('does not describe a day trip as an overnight stay', () => {
    expect(agentCopy.plan('上海', 1, 0, false)).not.toContain('0晚')
  })
})

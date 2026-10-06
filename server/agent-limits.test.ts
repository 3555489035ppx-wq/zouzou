import { describe, expect, it } from 'vitest'
import { AgentLocalLimiter } from './agent-limits'

describe('local demo request limiter', () => {
  it('bounds concurrent model requests and releases idempotently', () => {
    const limiter = new AgentLocalLimiter(20, 1)
    const release = limiter.acquire(1000)
    expect(release).not.toBeNull()
    expect(limiter.acquire(1000)).toBeNull()
    release!(); release!()
    expect(limiter.acquire(1001)).not.toBeNull()
  })
  it('bounds calls per minute even after completion', () => {
    const limiter = new AgentLocalLimiter(1, 2)
    limiter.acquire(1000)!()
    expect(limiter.acquire(2000)).toBeNull()
    expect(limiter.acquire(61000)).not.toBeNull()
  })
  it('does not erase concurrency when the rate window rolls over', () => {
    const limiter = new AgentLocalLimiter(20, 1)
    limiter.acquire(1000)
    expect(limiter.acquire(61000)).toBeNull()
  })
})

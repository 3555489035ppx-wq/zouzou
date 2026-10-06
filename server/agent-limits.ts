/** Process-local protection for the localhost development API, not a distributed quota. */
export class AgentLocalLimiter {
  private windowStart = 0
  private used = 0
  private active = 0
  constructor(private readonly maxPerMinute = 20, private readonly maxConcurrent = 2) {}
  acquire(now = Date.now()): (() => void) | null {
    if (now - this.windowStart >= 60000 || now < this.windowStart) { this.windowStart = now; this.used = 0 }
    if (this.active >= this.maxConcurrent || this.used >= this.maxPerMinute) return null
    this.used += 1
    this.active += 1
    let released = false
    return () => { if (!released) { released = true; this.active = Math.max(0, this.active - 1) } }
  }
}

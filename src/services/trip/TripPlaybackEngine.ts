export type TripExecutionState = 'overview' | 'moving' | 'arriving' | 'staying' | 'paused' | 'rerouting' | 'completed'
export type TripPlaybackMode = 'live' | 'replay'

export type TripPlaybackSnapshot = {
  mode: TripPlaybackMode
  state: TripExecutionState
  progress: number
  activeIndex: number
}

/**
 * One deterministic playback state machine shared by the live trip view and
 * community replay. A renderer can drive its marker with `progress`; a map
 * provider may additionally map the same transitions to moveAlong/pauseMove/
 * resumeMove/stopMove without changing product state.
 */
export class TripPlaybackEngine {
  readonly mode: TripPlaybackMode
  readonly totalStops: number
  private current: TripPlaybackSnapshot

  constructor(totalStops: number, mode: TripPlaybackMode = 'live') {
    this.totalStops = Math.max(1, totalStops)
    this.mode = mode
    this.current = { mode, state: 'overview', progress: 0, activeIndex: 0 }
  }

  get snapshot(): TripPlaybackSnapshot {
    return { ...this.current }
  }

  start() {
    if (this.current.state === 'completed') this.reset()
    if (this.current.state === 'overview' || this.current.state === 'paused' || this.current.state === 'arriving' || this.current.state === 'staying' || this.current.state === 'rerouting') this.current.state = 'moving'
    return this.snapshot
  }

  pause() {
    if (this.current.state === 'moving') this.current.state = 'paused'
    return this.snapshot
  }

  resume() {
    if (this.current.state === 'paused') this.current.state = 'moving'
    return this.snapshot
  }

  continueAfterArrival() {
    if (this.current.state === 'arriving' || this.current.state === 'staying') this.current.state = 'moving'
    return this.snapshot
  }

  markStaying() {
    if (this.current.state === 'arriving') this.current.state = 'staying'
    return this.snapshot
  }

  reroute() {
    if (this.current.state !== 'completed') this.current.state = 'rerouting'
    return this.snapshot
  }

  tick(delta: number) {
    if (this.current.state !== 'moving') return this.snapshot
    const safeDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0
    const previousIndex = this.current.activeIndex
    this.current.progress = Math.min(1, this.current.progress + safeDelta)
    this.current.activeIndex = Math.min(this.totalStops - 1, Math.floor(this.current.progress * (this.totalStops - 1) + 0.001))
    if (this.current.progress >= 1) this.current.state = 'completed'
    else if (this.current.activeIndex > previousIndex && this.mode === 'live') this.current.state = 'arriving'
    return this.snapshot
  }

  seek(progress: number) {
    this.current.progress = Math.max(0, Math.min(1, progress))
    this.current.activeIndex = Math.min(this.totalStops - 1, Math.floor(this.current.progress * (this.totalStops - 1) + 0.001))
    this.current.state = this.current.progress >= 1 ? 'completed' : 'overview'
    return this.snapshot
  }

  reset() {
    this.current = { mode: this.mode, state: 'overview', progress: 0, activeIndex: 0 }
    return this.snapshot
  }
}

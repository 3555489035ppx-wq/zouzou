import { describe, expect, it } from 'vitest'
import { TripPlaybackEngine } from './TripPlaybackEngine'

describe('TripPlaybackEngine', () => {
  it('keeps live arrival as a state on the same route', () => {
    const engine = new TripPlaybackEngine(3, 'live')
    expect(engine.snapshot.state).toBe('overview')
    expect(engine.start().state).toBe('moving')
    expect(engine.tick(0.51).state).toBe('arriving')
    expect(engine.snapshot.activeIndex).toBe(1)
    expect(engine.continueAfterArrival().state).toBe('moving')
    expect(engine.pause().state).toBe('paused')
    expect(engine.resume().state).toBe('moving')
  })

  it('replays through stops without pausing at each node', () => {
    const engine = new TripPlaybackEngine(3, 'replay')
    engine.start()
    expect(engine.tick(0.51).state).toBe('moving')
    expect(engine.tick(0.6).state).toBe('completed')
    expect(engine.snapshot.progress).toBe(1)
  })
})


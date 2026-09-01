import { describe, expect, it } from 'vitest'
import { matchLocationToRoute } from './matching'

describe('route location matching', () => {
  const path = [[121.4, 31.2], [121.41, 31.2], [121.41, 31.21]] as [number, number][]

  it('returns the nearest point and distance along a curved route', () => {
    const match = matchLocationToRoute([121.405, 31.201], path)

    expect(match).not.toBeNull()
    expect(match?.nearestPoint[0]).toBeCloseTo(121.405, 5)
    expect(match?.nearestPoint[1]).toBeCloseTo(31.2, 5)
    expect(match?.routeDistance).toBeGreaterThan(400)
    expect(match?.progress).toBeGreaterThan(.2)
    expect(match?.progress).toBeLessThan(.4)
  })

  it('returns null when a route has no geometry to match', () => {
    expect(matchLocationToRoute([121.4, 31.2], [[121.4, 31.2]])).toBeNull()
  })
})

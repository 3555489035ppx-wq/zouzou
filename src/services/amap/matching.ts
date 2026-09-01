import type { AMapPoint } from './provider'

export type RouteMatch = {
  nearestPoint: AMapPoint
  distanceFromRoute: number
  routeDistance: number
  progress: number
  segmentIndex: number
}

const METERS_PER_DEGREE_LAT = 111_132.92

const projectToSegment = (point: AMapPoint, from: AMapPoint, to: AMapPoint) => {
  const referenceLat = ((from[1] + to[1] + point[1]) / 3) * Math.PI / 180
  const metersPerDegreeLng = 111_412.84 * Math.cos(referenceLat)
  const toMeters = ([lng, lat]: AMapPoint): [number, number] => [lng * metersPerDegreeLng, lat * METERS_PER_DEGREE_LAT]
  const projectedPoint = toMeters(point)
  const projectedFrom = toMeters(from)
  const projectedTo = toMeters(to)
  const dx = projectedTo[0] - projectedFrom[0]
  const dy = projectedTo[1] - projectedFrom[1]
  const lengthSquared = dx * dx + dy * dy
  const ratio = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((projectedPoint[0] - projectedFrom[0]) * dx + (projectedPoint[1] - projectedFrom[1]) * dy) / lengthSquared))
  const nearestPoint: AMapPoint = [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]
  const projectedNearest = toMeters(nearestPoint)
  const segmentLength = Math.sqrt(lengthSquared)
  return {
    nearestPoint,
    distance: Math.hypot(projectedPoint[0] - projectedNearest[0], projectedPoint[1] - projectedNearest[1]),
    segmentLength,
    ratio,
  }
}

export function matchLocationToRoute(location: AMapPoint, path: AMapPoint[]): RouteMatch | null {
  if (path.length < 2) return null
  let routeDistance = 0
  let best: RouteMatch | null = null
  const segments = path.slice(1).map((point, index) => ({ from: path[index], to: point }))
  const totalDistance = segments.reduce((total, segment) => total + projectToSegment(segment.to, segment.from, segment.to).segmentLength, 0)
  if (totalDistance === 0) return null
  segments.forEach((segment, segmentIndex) => {
    const projection = projectToSegment(location, segment.from, segment.to)
    const candidate = {
      nearestPoint: projection.nearestPoint,
      distanceFromRoute: projection.distance,
      routeDistance: routeDistance + projection.segmentLength * projection.ratio,
      progress: Math.max(0, Math.min(1, (routeDistance + projection.segmentLength * projection.ratio) / totalDistance)),
      segmentIndex,
    }
    if (!best || candidate.distanceFromRoute < best.distanceFromRoute) best = candidate
    routeDistance += projection.segmentLength
  })
  return best
}

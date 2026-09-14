import type { Place } from '../demo-data/trips'

export type CoordinateSystem = 'wgs84' | 'gcj02' | 'bd09ll'

export type PlaceCoordinates = {
  latitude: number
  longitude: number
  coordinateSystem?: CoordinateSystem
}

type PlaceCoordinateInput = {
  latitude?: unknown
  longitude?: unknown
  lat?: unknown
  lng?: unknown
  coordinates?: unknown
  coordinateSystem?: unknown
  location?: unknown
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function isValidCoordinatePair(latitude: unknown, longitude: unknown): latitude is number {
  return finite(latitude)
    && finite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0)
}

export function getPlaceCoordinates(place: PlaceCoordinateInput): PlaceCoordinates | null {
  const coordinateSystem = place.coordinateSystem === 'gcj02' || place.coordinateSystem === 'bd09ll' || place.coordinateSystem === 'wgs84'
    ? place.coordinateSystem
    : undefined

  if (finite(place.latitude) && finite(place.longitude) && isValidCoordinatePair(place.latitude, place.longitude)) {
    return { latitude: place.latitude, longitude: place.longitude, coordinateSystem }
  }
  if (finite(place.lat) && finite(place.lng) && isValidCoordinatePair(place.lat, place.lng)) {
    return { latitude: place.lat, longitude: place.lng, coordinateSystem }
  }
  if (Array.isArray(place.coordinates) && place.coordinates.length >= 2) {
    const [longitude, latitude] = place.coordinates
    if (finite(latitude) && finite(longitude) && isValidCoordinatePair(latitude, longitude)) return { latitude, longitude, coordinateSystem }
  }
  if (place.location && typeof place.location === 'object' && !Array.isArray(place.location)) {
    return getPlaceCoordinates({ ...(place.location as Record<string, unknown>), coordinateSystem })
  }
  return null
}

export function coordinateArray(place: PlaceCoordinateInput): [number, number] | null {
  const coordinates = getPlaceCoordinates(place)
  return coordinates ? [coordinates.longitude, coordinates.latitude] : null
}

export function normalizePlace(input: Partial<Place> & Record<string, unknown>, defaults: Partial<Place> = {}): Place {
  const { latitude: _latitude, longitude: _longitude, lat: _lat, lng: _lng, coordinates: _coordinates, location: _location, ...rest } = input
  const source = { ...defaults, ...rest } as Record<string, unknown>
  const coordinates = getPlaceCoordinates(input)
  const name = String(source.name ?? source.title ?? source.locationName ?? source.poiName ?? source.inputName ?? '未命名地点')
  const address = typeof source.address === 'string'
    ? source.address
    : typeof input.location === 'string'
      ? input.location
      : undefined
  const normalized: Place = {
    ...source,
    id: String(source.id ?? `place-${name}`),
    time: String(source.time ?? '09:30'),
    name,
    type: String(source.type ?? '地点'),
    stay: String(source.stay ?? '30min'),
    budget: finite(source.budget) && source.budget >= 0 ? source.budget : 0,
    transport: String(source.transport ?? '前往方式待确认'),
    note: String(source.note ?? ''),
    ...(address ? { address } : {}),
  }
  if (coordinates) {
    normalized.latitude = coordinates.latitude
    normalized.longitude = coordinates.longitude
    normalized.lng = coordinates.longitude
    normalized.lat = coordinates.latitude
    normalized.coordinateSystem = coordinates.coordinateSystem
    normalized.mapStatus = normalized.mapStatus ?? 'resolved'
  } else {
    delete normalized.latitude
    delete normalized.longitude
    delete normalized.lng
    delete normalized.lat
    delete normalized.coordinates
    if (normalized.mapStatus === 'resolved') normalized.mapStatus = 'unresolved'
  }
  return normalized
}

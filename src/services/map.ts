import { tripDays, type Place } from '../demo-data/trips'

export interface MapService {
  getRoute(day: string): Promise<Place[]>
}

class LocalMapAdapter implements MapService {
  async getRoute(day: string) { return tripDays[day] ?? tripDays['Day 1'] }
}

export const mapService: MapService = new LocalMapAdapter()

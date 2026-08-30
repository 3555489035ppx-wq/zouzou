export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'

export type CurrentLocation = {
  latitude: number
  longitude: number
  accuracy: number | null
}

export class LocationError extends Error {
  constructor(public readonly status: Exclude<LocationStatus, 'idle' | 'requesting' | 'granted'>, message: string) {
    super(message)
    this.name = 'LocationError'
  }
}

export function requestCurrentLocation(options: PositionOptions = {}): Promise<CurrentLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new LocationError('unavailable', '当前浏览器不支持定位。'))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      }),
      (error) => {
        if (error.code === 1) reject(new LocationError('denied', '你拒绝了定位权限，仍可手动选择城市。'))
        else reject(new LocationError('error', '暂时无法获取当前位置，请检查系统定位设置。'))
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000, ...options },
    )
  })
}

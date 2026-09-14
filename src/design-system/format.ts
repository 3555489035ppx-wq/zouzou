/** Display units only; stored schedules and calculations retain their source values. */
export const formatTravelDuration = (value: string) => value.replace(/(\d+(?:\.\d+)?)\s*h\b/gi, (_, hours: string) => {
  const minutes = Math.round(Number(hours) * 60)
  return `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分钟` : ''}`
}).replace(/(\d+)\s*min\b/gi, '$1分钟')

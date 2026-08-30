import { afterEach, describe, expect, it, vi } from 'vitest'
import { readVersioned, writeVersioned } from './storage'

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('versioned browser storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('migrates legacy JSON values into the versioned envelope', () => {
    const sessionStorage = createMemoryStorage()
    vi.stubGlobal('window', { sessionStorage, localStorage: createMemoryStorage() })
    sessionStorage.setItem('trip', JSON.stringify({ destination: '上海' }))

    expect(readVersioned<{ destination: string }>('trip')).toEqual({ destination: '上海' })
    expect(sessionStorage.getItem('trip')).toContain('"version":1')
  })

  it('keeps the old unquoted trip prompt recoverable', () => {
    const sessionStorage = createMemoryStorage()
    vi.stubGlobal('window', { sessionStorage, localStorage: createMemoryStorage() })
    sessionStorage.setItem('trip-input', '我想去上海')

    expect(readVersioned<string>('trip-input', 'session', true)).toBe('我想去上海')
    expect(readVersioned<string>('trip-input')).toBe('我想去上海')
    writeVersioned('trip-input', '下一次旅行')
    expect(readVersioned<string>('trip-input')).toBe('下一次旅行')
  })
})

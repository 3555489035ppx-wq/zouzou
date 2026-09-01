import { describe, expect, it } from 'vitest'
import { createPackingSeed, packingProgress, summarizeExpenses, type TripExpense } from './journeyTools'

describe('Journey tools', () => {
  it('summarizes expenses by category and journey', () => {
    const expenses: TripExpense[] = [
      { id: 'one', journeyId: 'shanghai', amount: 120, currency: 'CNY', category: '交通', participantIds: [], occurredAt: '2026-08-31', createdAt: '2026-08-31' },
      { id: 'two', journeyId: 'shanghai', amount: 80.5, currency: 'CNY', category: '餐饮', participantIds: [], occurredAt: '2026-08-31', createdAt: '2026-08-31' },
      { id: 'three', journeyId: 'other', amount: 999, currency: 'CNY', category: '购物', participantIds: [], occurredAt: '2026-08-31', createdAt: '2026-08-31' },
    ]
    expect(summarizeExpenses(expenses, 'shanghai')).toEqual({
      total: 200.5,
      byCategory: { 交通: 120, 餐饮: 80.5, 住宿: 0, 门票: 0, 购物: 0, 娱乐: 0, 其他: 0 },
    })
  })

  it('generates weather and activity-aware packing items', () => {
    const items = createPackingSeed({ journeyId: 'quanzhou', city: '泉州', days: 4, weather: '24–31°C 有雨', activities: '爬山' })
    expect(items.map((item) => item.label)).toEqual(expect.arrayContaining(['身份证', '充电器', '雨伞或雨衣', '运动鞋', '换洗衣物']))
    expect(packingProgress(items, 'quanzhou')).toMatchObject({ total: items.length, completed: 0, state: 'partially-completed' })
    expect(packingProgress(items.map((item) => ({ ...item, checked: true })), 'quanzhou').state).toBe('completed')
  })
})

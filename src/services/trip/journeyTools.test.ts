import { describe, expect, it } from 'vitest'
import { createPackingSeed, mergePackingSuggestions, formatExpenseMoney, packingProgress, summarizeExpenses, splitExpenseBalances, type TripExpense } from './journeyTools'

describe('Journey tools', () => {
  it('fills a custom list without resetting checks, restoring dismissed items or leaking across trips', () => {
    const seed = createPackingSeed({ journeyId: 'a', city: '上海', days: 2 })
    const checked = { ...seed[0], checked: true, note: '已经放进背包' }
    const custom = { ...seed[1], id: 'custom', label: '  手机  ', recommended: false }
    const other = { ...checked, id: 'other', journeyId: 'b' }
    const result = mergePackingSuggestions([checked, custom, other], [...seed, ...seed], [seed[2].id])
    expect(result.find(item => item.id === checked.id)).toBe(checked)
    expect(result).toContain(custom)
    expect(result).toContain(other)
    expect(result.some(item => item.id === seed[1].id || item.id === seed[2].id)).toBe(false)
    expect(result.filter(item => item.journeyId === 'a')).toHaveLength(seed.length - 1)
    expect(mergePackingSuggestions(result, seed, [seed[2].id])).toBe(result)
  })

  it('shows local currency plainly and preserves the identity of historic foreign amounts', () => {
    expect(formatExpenseMoney(12.5)).toBe('¥12.50')
    expect(formatExpenseMoney(12.5, 'USD')).toBe('USD 12.50')
    expect(formatExpenseMoney(-8, 'CNY')).toBe('¥-8.00')
  })
  it('splits indivisible cents without creating money and keeps currencies separate', () => {
    const expense:TripExpense={id:'aa',journeyId:'trip',amount:10,currency:'CNY',category:'餐饮',payerId:'甲',participantIds:['甲','乙','丙','甲'],occurredAt:'2026-09-05',createdAt:'2026-09-05'}
    const result=splitExpenseBalances([expense,{...expense,id:'usd',currency:'USD',amount:0.01}])
    expect(result).toHaveLength(2)
    for(const group of result)expect(group.people.reduce((sum,person)=>sum+person.cents,0)).toBe(0)
    expect(result[0].people.find(person=>person.name==='甲')!.cents).toBeGreaterThanOrEqual(666)
    expect(splitExpenseBalances([{...expense,participantIds:[]}])).toEqual([])
  })
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
    expect(items.length).toBeGreaterThanOrEqual(20)
    expect(items.map((item) => item.label)).toEqual(expect.arrayContaining(['身份证', '充电器', '充电宝', '保存酒店与车票信息', '雨伞或雨衣', '运动鞋', '随身水', '换洗衣物']))
    expect(packingProgress(items, 'quanzhou')).toMatchObject({ total: items.length, completed: 0, state: 'partially-completed' })
    expect(packingProgress(items.map((item) => ({ ...item, checked: true })), 'quanzhou').state).toBe('completed')
  })
})

export const EXPENSE_CATEGORIES = ['交通', '餐饮', '住宿', '门票', '购物', '娱乐', '其他'] as const
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export type TripExpense = {
  id: string
  journeyId: string
  dayId?: string
  placeId?: string
  amount: number
  currency: string
  category: ExpenseCategory
  payerId?: string
  participantIds: string[]
  note?: string
  occurredAt: string
  createdAt: string
}

export const PACKING_CATEGORIES = ['必带', '天气', '活动', '个人'] as const
export type PackingCategory = typeof PACKING_CATEGORIES[number]

export type PackingItem = {
  id: string
  journeyId: string
  label: string
  category: PackingCategory
  checked: boolean
  recommended: boolean
  createdAt: string
}

export type Footprint = {
  id: string
  userId: string
  journeyId?: string
  placeId?: string
  city: string
  country: string
  visitedAt: string
  coordinates?: [number, number]
  source: 'journey' | 'manual'
  photos?: string[]
  note?: string
  createdAt: string
}

export type ExpenseSummary = {
  total: number
  byCategory: Record<ExpenseCategory, number>
}

const emptyCategoryTotals = (): Record<ExpenseCategory, number> => Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category, 0])) as Record<ExpenseCategory, number>
const money = (value: number) => Math.round(value * 100) / 100

export function summarizeExpenses(expenses: TripExpense[], journeyId?: string): ExpenseSummary {
  const summary = emptyCategoryTotals()
  const scoped = journeyId ? expenses.filter((expense) => expense.journeyId === journeyId) : expenses
  for (const expense of scoped) {
    if (!Number.isFinite(expense.amount) || expense.amount < 0) continue
    summary[expense.category] = money(summary[expense.category] + expense.amount)
  }
  return { total: money(Object.values(summary).reduce((total, amount) => total + amount, 0)), byCategory: summary }
}

export function createPackingSeed({ journeyId, city, days, weather = '晴朗', activities = '' }: { journeyId: string; city: string; days: number; weather?: string; activities?: string }): PackingItem[] {
  const now = new Date().toISOString()
  const labels: Array<[string, PackingCategory]> = [
    ['身份证', '必带'],
    ['手机', '必带'],
    ['充电器', '必带'],
    ['常用药品', '个人'],
    ['洗漱用品', '个人'],
  ]
  if (/雨|湿|台风/.test(weather)) labels.push(['雨伞或雨衣', '天气'])
  if (/冷|低温|雪/.test(weather)) labels.push(['薄外套', '天气'])
  if (/热|高温|晴/.test(weather)) labels.push(['防晒', '天气'])
  if (/爬山|徒步|登山/.test(activities)) labels.push(['运动鞋', '活动'], ['随身水', '活动'])
  if (days >= 3) labels.push(['换洗衣物', '个人'])
  return labels.map(([label, category], index) => ({ id: `${journeyId}-packing-${index + 1}`, journeyId, label, category, checked: false, recommended: true, createdAt: now }))
}

export function packingProgress(items: PackingItem[], journeyId?: string) {
  const scoped = journeyId ? items.filter((item) => item.journeyId === journeyId) : items
  const completed = scoped.filter((item) => item.checked).length
  return { total: scoped.length, completed, state: scoped.length === 0 ? 'empty' as const : completed === scoped.length ? 'completed' as const : 'partially-completed' as const }
}

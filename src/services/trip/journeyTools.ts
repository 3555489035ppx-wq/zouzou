export const EXPENSE_CATEGORIES = ['交通', '餐饮', '住宿', '门票', '购物', '娱乐', '其他'] as const
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export type TripExpense = {
  id: string
  journeyId: string
  tripRevision?: number
  dayId?: string
  placeId?: string
  amount: number
  amountMinor?: number
  kind?: 'payment' | 'refund'
  splitMode?: 'equal' | 'amount' | 'shares'
  allocations?: Record<string, number>
  settled?: boolean
  currency: string
  category: ExpenseCategory
  payerId?: string
  participantIds: string[]
  note?: string
  occurredAt: string
  createdAt: string
}

export const PACKING_CATEGORIES = ['必带', '数码', '衣物', '洗漱', '健康', '天气', '活动', '个人'] as const
export type PackingCategory = typeof PACKING_CATEGORIES[number]

export type PackingItem = {
  id: string
  journeyId: string
  tripRevision?: number
  label: string
  category: PackingCategory
  checked: boolean
  recommended: boolean
  ownerId?: string
  note?: string
  priority?: 'required' | 'recommended' | 'optional'
  createdAt: string
}

export type Footprint = {
  id: string
  userId: string
  journeyId?: string
  tripRevision?: number
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
    summary[expense.category] = money(summary[expense.category] + expenseSignedMinor(expense) / 100)
  }
  return { total: money(Object.values(summary).reduce((total, amount) => total + amount, 0)), byCategory: summary }
}

export function createPackingSeed({ journeyId, city, days, weather = '', activities = '' }: { journeyId: string; city: string; days: number; weather?: string; activities?: string }): PackingItem[] {
  const now = new Date().toISOString()
  const labels: Array<[string, PackingCategory]> = [
    ['身份证', '必带'],
    ['手机', '数码'],
    ['充电器', '数码'],
    ['充电宝', '数码'],
    ['备用充电线', '数码'],
    ['银行卡 / 少量现金', '必带'],
    ['保存酒店与车票信息', '必带'],
    ['门票与预约凭证', '必带'],
    ['紧急联系人信息', '必带'],
    ['常用药品', '健康'],
    ['创可贴', '健康'],
    ['口罩', '健康'],
    ['洗漱用品', '洗漱'],
    ['牙刷 / 牙膏', '洗漱'],
    ['毛巾', '洗漱'],
    ['梳子', '洗漱'],
    ['纸巾 / 湿巾', '洗漱'],
    ['换洗衣物', '衣物'],
    ['内衣 / 袜子', '衣物'],
    ['睡衣', '衣物'],
    ['脏衣袋', '衣物'],
    ['护肤品 / 唇膏', '洗漱'],
    ['眼镜 / 隐形护理', '个人'],
    ['耳机（按需）', '数码'],
    ['个人卫生用品', '个人'],
    ['雨伞或雨衣', '天气'],
    ['薄外套', '天气'],
    ['防晒', '天气'],
    ['遮阳帽', '天气'],
  ]
  if (/冷|低温|雪/.test(weather)) labels.push(['保暖衣物 / 手套', '天气'])
  if (/爬山|徒步|登山/.test(activities)) labels.push(['运动鞋', '活动'], ['随身水', '活动'], ['轻便背包', '活动'], ['防磨脚贴', '活动'])
  else labels.push(['舒适步行鞋', '活动'], ['随身水', '活动'], ['轻便背包', '活动'], ['相机 / 备用存储', '活动'], ['防磨脚贴', '活动'])
  if (/海滩|海边|游泳|温泉/.test(activities)) labels.push(['泳衣 / 泳帽', '活动'], ['防水收纳袋', '活动'])
  if (days >= 3) labels.push(['额外换洗衣物', '衣物'])
  if (days >= 5) labels.push(['行李收纳袋', '衣物'])
  return labels.map(([label, category]) => ({ id: `${journeyId}-packing-${encodeURIComponent(label)}`, journeyId, label, category, checked: false, recommended: true, priority: category === '必带' ? 'required' : 'optional', createdAt: now }))
}

/** Re-entering a trip may add new templates, but never resets a person's choices. */
export function mergePackingSuggestions(existing: PackingItem[], suggestions: PackingItem[], dismissed: string[]) {
  const ids = new Set([...existing.map(item => item.id), ...dismissed])
  const labels = new Set(existing.map(item => `${item.journeyId}:${item.label.trim()}`))
  const additions = suggestions.filter(item => {
    const label = `${item.journeyId}:${item.label.trim()}`
    if (ids.has(item.id) || labels.has(label)) return false
    ids.add(item.id); labels.add(label)
    return true
  })
  return additions.length ? [...existing, ...additions] : existing
}

export const formatExpenseMoney = (amount: number, currency = 'CNY') => `${currency === 'CNY' ? '¥' : `${currency} `}${amount.toFixed(2)}`

export function packingProgress(items: PackingItem[], journeyId?: string) {
  const scoped = journeyId ? items.filter((item) => item.journeyId === journeyId) : items
  const completed = scoped.filter((item) => item.checked).length
  return { total: scoped.length, completed, state: scoped.length === 0 ? 'empty' as const : completed === scoped.length ? 'completed' as const : 'partially-completed' as const }
}

/** Integer cents, per-currency balances. A local label is not an authenticated member. */
export function splitExpenseBalances(expenses: TripExpense[]) {
  const balances: Record<string, Record<string, number>> = {}
  for (const expense of expenses) {
    if (!expense.payerId || !Number.isFinite(expense.amount) || expense.amount <= 0) continue
    const participants = [...new Set(expense.participantIds.filter(Boolean))].sort()
    if (!participants.length) continue
    const cents = expenseSignedMinor(expense)
    const allocation = allocateExpense(expense)
    const currency = balances[expense.currency] ??= {}
    currency[expense.payerId] = (currency[expense.payerId] ?? 0) + cents
    participants.forEach((person, index) => { currency[person] = (currency[person] ?? 0) - (allocation[person] ?? 0) })
  }
  return Object.entries(balances).map(([currency, people]) => ({currency,people:Object.entries(people).map(([name,cents])=>({name,cents}))}))
}

export const expenseSignedMinor = (expense: TripExpense) => (expense.kind === 'refund' ? -1 : 1) * (expense.amountMinor ?? Math.round(expense.amount * 100))
export function allocateExpense(expense: TripExpense): Record<string, number> {
  const people = [...new Set(expense.participantIds)].sort()
  const total = Math.abs(expenseSignedMinor(expense)), sign = expense.kind === 'refund' ? -1 : 1
  if (!people.length) return {}
  if (expense.splitMode === 'amount') {
    const amounts = people.map(id => expense.allocations?.[id] ?? 0)
    if (amounts.some(n => !Number.isInteger(n) || n < 0) || amounts.reduce((a,b)=>a+b,0) !== total) throw Error('分摊金额之和必须等于本笔金额')
    return Object.fromEntries(people.map((id,i)=>[id, amounts[i]*sign]))
  }
  const weights = people.map(id=>expense.splitMode === 'shares' ? expense.allocations?.[id] ?? 1 : 1)
  if (weights.some(n=>!Number.isFinite(n)||n<=0)) throw Error('份数必须大于0')
  const sum=weights.reduce((a,b)=>a+b,0), base=weights.map(n=>Math.floor(total*n/sum))
  let remainder=total-base.reduce((a,b)=>a+b,0)
  for(let i=0;remainder>0;i=(i+1)%people.length,remainder--) base[i]++
  return Object.fromEntries(people.map((id,i)=>[id,base[i]*sign]))
}

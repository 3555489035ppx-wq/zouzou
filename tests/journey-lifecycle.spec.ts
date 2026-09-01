import { expect, test } from '@playwright/test'

test('五步 onboarding 可以继续了解并完成', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('status', { name: '引导第 1 步，共 5 步' })).toBeVisible()
  await page.getByRole('button', { name: '继续了解' }).click()
  await expect(page.getByRole('heading', { name: '想去哪，说一句就行' })).toBeVisible()
  await page.getByRole('button', { name: '继续了解' }).click()
  await expect(page.getByRole('heading', { name: '路线、地点、每天安排一次生成' })).toBeVisible()
  await page.getByRole('button', { name: '继续了解' }).click()
  await expect(page.getByRole('heading', { name: '旅途中需要的信息都在这里' })).toBeVisible()
  await page.getByRole('button', { name: '继续了解' }).click()
  await expect(page.getByRole('heading', { name: '记账、行李、足迹也一起记住' })).toBeVisible()
  await page.getByRole('button', { name: '开始走走' }).click()
  await expect(page).toHaveURL(/\/home/)
})

test('Journey 详情支持添加、编辑时间、跨日移动、排序和删除', async ({ page }) => {
  await page.goto('/travel/plan/match')
  await page.getByRole('button', { name: '更多操作' }).first().click()
  await expect(page.getByRole('heading', { name: '编辑地点' })).toBeVisible()
  await page.getByLabel('时间').fill('10:15')
  await page.getByLabel('所在行程日').selectOption('Day 2')
  await page.getByLabel('备注').fill('已调整到第二天，保留更多缓冲。')
  await page.getByRole('button', { name: '保存地点' }).click()
  await expect(page.getByRole('status')).toContainText('行程已保存')
  await expect(page.getByRole('tab', { name: 'Day 2' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('10:15', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '添加地点' }).click()
  await page.getByLabel('地点名称').fill('一间书店')
  await page.getByLabel('安排在').selectOption('Day 2')
  await page.getByRole('button', { name: '添加并保存' }).click()
  await expect(page.getByRole('status')).toContainText('地点已添加')
  const customPlace = page.locator('.place-card').filter({ hasText: '一间书店' })
  await expect(customPlace).toBeVisible()
  await customPlace.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('button', { name: '删除这个地点' }).click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByText('一间书店', { exact: true })).toHaveCount(0)

  await page.reload()
  await page.getByRole('tab', { name: 'Day 2' }).click()
  await expect(page.getByText('10:15', { exact: true })).toBeVisible()
})

test('完成的 Journey 可以归档并在我的行程恢复显示', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('zouzou-demo-v2', JSON.stringify({
      state: {
        city: '上海',
        tripCity: '上海',
        activeRouteId: 'route-1',
        tripMode: 'completed',
        personalTrips: [{ id: 'trip-route-1', routeId: 'route-1', city: '上海', status: 'completed', createdAt: '2026-08-30T00:00:00.000Z' }],
      },
      version: 3,
    }))
  })
  await page.goto('/trips')
  await expect(page.getByRole('heading', { name: '今天走完啦' })).toBeVisible()
  await page.getByRole('button', { name: '归档这次行程' }).click()
  await expect(page).toHaveURL(/\/profile\/trips/)
  await expect(page.locator('.trip-record span[data-status="archived"]')).toBeVisible()
  await page.getByRole('button', { name: '恢复行程' }).click()
  await expect(page.getByText(/进行中|已完成|即将开始/).first()).toBeVisible()
})

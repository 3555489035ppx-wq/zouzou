import { expect, test } from '@playwright/test'

test('移动端地点概览不会遮住外部地图入口', async ({ page }) => {
  await page.goto('/travel/plan/match')
  await page.getByRole('radio', { name: '地点顺序' }).click()

  const map = page.locator('.route-overview')
  await expect(map).toBeVisible({ timeout: 12_000 })
  await expect(map).toHaveAttribute('data-map-provider', 'external')
  await expect(map.locator('.route-overview__list > li')).toHaveCount(7)
  await map.getByRole('button', { name: /打开.*地图/ }).first().click()
  await expect(page.getByRole('heading', { name: /打开.*地图/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '百度地图' })).toBeVisible()
})

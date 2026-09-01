import { expect, test } from '@playwright/test'

test('移动端高德容器不会遮住地图表面', async ({ page }) => {
  await page.goto('/travel/plan/match')
  await page.getByRole('radio', { name: '地图' }).click()

  const map = page.locator('.real-route-map')
  const surface = map.locator('.real-route-map__canvas')
  await expect(map).toBeVisible({ timeout: 12_000 })
  await expect(surface).toBeVisible({ timeout: 12_000 })
  await expect(surface).toHaveClass(/amap-container/, { timeout: 12_000 })
  await expect.poll(async () => surface.evaluate((element) => getComputedStyle(element).backgroundColor), { timeout: 12_000 }).toBe('rgba(0, 0, 0, 0)')
  await expect.poll(async () => map.evaluate((element) => getComputedStyle(element).backgroundImage), { timeout: 12_000 }).not.toBe('none')
})

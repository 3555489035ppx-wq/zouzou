import { expect, test } from '@playwright/test'

test('个人页会恢复为空的封面，并展示完整的封面画面', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('zouzou-demo-v2', JSON.stringify({ state: { cover: '' }, version: 2 }))
  })
  await page.goto('/profile')
  await expect(page.locator('.profile-cover img')).toHaveAttribute('src', '/assets/shanghai-skyline.jpg')
  await expect(page.locator('.profile-cover')).toHaveClass(/profile-cover--immersive/)
  await expect(page.getByText('把走过的路，留在这一页')).toHaveCount(0)
})

test('发现页只呈现走走整理的路线', async ({ page }) => {
  await page.goto('/discover')
  await expect(page.getByText('用户分享', { exact: true })).toHaveCount(0)
  await expect(page.getByText('武康路慢慢走', { exact: true })).toHaveCount(0)
})

test('约会可以直接选择同行头像人数', async ({ page }) => {
  await page.goto('/date')
  await expect(page.getByRole('radio', { name: '2人' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: '3人' }).click()
  await expect(page.getByRole('radio', { name: '3人' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.group-people-picker__hint')).toContainText('已选 3 人')
})

test('我的足迹使用真实地图承载城市标记', async ({ page }) => {
  await page.goto('/journey/footprint')
  await expect(page.getByLabel('我的足迹城市概览')).toBeVisible()
})

test('邀请朋友会调用系统分享并带上可打开的邀请链接', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload: ShareData) => { (window as Window & { __inviteShare?: ShareData }).__inviteShare = payload },
    })
  })
  await page.goto('/travel/friends')
  await page.getByRole('button', { name: '邀请', exact: true }).click()
  await page.getByRole('button', { name: '分享链接' }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __inviteShare?: ShareData }).__inviteShare?.url ?? '')).toContain('/travel/friends?invite=1')
})

test('评论面板的关闭按钮保持紧凑', async ({ page }) => {
  await page.goto('/community')
  await page.locator('.community-card__open').first().click()
  await page.getByRole('button', { name: '评论' }).click()
  const close = page.getByRole('button', { name: '关闭', exact: true })
  await expect(close).toBeVisible()
  const box = await close.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(40)
  expect(box?.height).toBeLessThanOrEqual(40)
})

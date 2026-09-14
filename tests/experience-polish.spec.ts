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
  await expect(page.locator('.explore-wordmark')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '全部路线', exact: true })).toBeVisible()
  await expect(page.getByText('60 个城市的完整路线', { exact: true })).toHaveCount(0)
  await expect(page.locator('.explore-plaza .discover-card')).toHaveCount(108)
  await page.locator('.explore-filter-strip button').filter({ hasText: '精选' }).click()
  await expect(page.locator('.explore-plaza .discover-card')).toHaveCount(6)
})

test('进行中的 GoGoBot 可点击切换 30 种动作形态', async ({ page }) => {
  await page.goto('/trips')
  const bot = page.locator('.trip-progress-card .motion-bot')
  await expect(bot).toHaveAttribute('data-bot-interactive', 'true')
  await expect(bot).toHaveAttribute('role', 'button')
  await expect(bot).toHaveCSS('width', '56px')
  await expect(bot).not.toContainText('GoGoBot')
  await expect(bot).toHaveAttribute('aria-label', /30 种动作/)
  const variants = new Set<string>()
  for (let index = 0; index < 20; index += 1) {
    await bot.click()
    variants.add((await bot.getAttribute('data-bot-variant')) ?? '')
  }
  expect(variants.size).toBe(20)
  await expect(bot).toHaveClass(/is-reacting/)
})

test('无截图时理解流程隐藏截图识别步骤并完成打勾', async ({ page }) => {
  await page.goto('/travel/new')
  await page.getByRole('button', { name: '帮我看看' }).click()
  const progress = page.locator('.progress-steps')
  await expect(progress.getByText('读取你的描述', { exact: true })).toBeVisible()
  await expect(progress.getByText('识别 0 张截图', { exact: true })).toHaveCount(0)
  await expect(progress.getByText('整理地点与偏好', { exact: true })).toBeVisible()
  await expect(progress.getByText('检查路线与天气', { exact: true })).toBeVisible()
  await expect(progress.getByText('生成可行方案', { exact: true })).toBeVisible()
  await expect(progress.getByText('完成', { exact: true })).toBeVisible()
  await expect(page.getByText('这是我理解的旅行')).toBeVisible({ timeout: 7_000 })
  await expect(progress.locator('.is-done')).toHaveCount(5)
})

test('城市记忆使用无地图的城市时间线', async ({ page }) => {
  await page.goto('/journey/footprint')
  await expect(page.getByLabel('城市记忆')).toBeVisible()
  await expect(page.locator('.footprint-map')).toHaveCount(0)
  await expect(page.getByText('真实路线请用地图 App 打开', { exact: false })).toHaveCount(0)
  await expect(page.getByText('留下足迹', { exact: true })).toHaveCount(0)
})

test('分享行程会调用移动端系统分享', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload: ShareData) => { (window as Window & { __journeyShare?: ShareData }).__journeyShare = payload },
    })
  })
  await page.goto('/journey/share')
  await page.getByRole('button', { name: '分享这段行程' }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __journeyShare?: ShareData }).__journeyShare?.url ?? '')).toContain('/journey/share')
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
  await expect.poll(() => page.evaluate(() => (window as Window & { __inviteShare?: ShareData }).__inviteShare?.url ?? '')).toMatch(/\/group-plans\/invite\//)
  await page.goto(await page.evaluate(() => (window as Window & { __inviteShare?: ShareData }).__inviteShare?.url ?? ''))
  await expect(page.getByText('提交你的偏好', { exact: true })).toBeVisible()
  await expect(page.getByText('发起人', { exact: true })).toBeVisible()
})

test('邀请朋友可以复制真实邀请链接', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __inviteCopy?: string }).__inviteCopy = text } },
    })
  })
  await page.goto('/travel/friends')
  await page.getByRole('button', { name: '邀请', exact: true }).click()
  await page.getByRole('button', { name: '复制链接' }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __inviteCopy?: string }).__inviteCopy ?? '')).toMatch(/\/group-plans\/invite\//)
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

import { expect, test } from '@playwright/test'

test('登录到首页并保持头像与四 Tab', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '手机号登录' }).click()
  await page.getByRole('button', { name: '获取验证码' }).click()
  await page.getByLabel('6 位验证码').fill('123456')
  await page.getByRole('button', { name: '验证并继续' }).click()
  await expect(page).toHaveURL(/onboarding/)
  await page.getByRole('button', { name: '进入走走' }).click()
  await expect(page).toHaveURL(/home/)
  await expect(page.getByRole('button', { name: /上海.*26°C/ })).toBeVisible()
  for (const tab of ['首页', '行程', '社区', '我']) await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible()
})

test('旅行输入到三方案再到方案详情', async ({ page }) => {
  await page.goto('/travel/new')
  await page.getByRole('button', { name: '帮我看看' }).click()
  await expect(page.getByText('这是我理解的旅行')).toBeVisible({ timeout: 7_000 })
  await page.getByRole('button', { name: '开始规划' }).click()
  await expect(page).toHaveURL(/travel\/plans/, { timeout: 7_000 })
  await expect(page.getByText('最匹配', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '查看这套走法' }).first().click()
  await expect(page).toHaveURL(/travel\/plan\/match/)
  await expect(page.getByText('时间与预算已校验')).toBeVisible()
  await expect(page.getByText('虹桥火车站', { exact: true })).toBeVisible()
  await expect(page.getByText('武康路', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Day 2' }).click()
  await expect(page.getByText('上海博物馆东馆', { exact: true })).toBeVisible()
})

test('社区卡片直接进入详情、可互动并可选回放', async ({ page }) => {
  await page.goto('/community')
  const firstPost = page.locator('.community-card__open').first()
  await firstPost.click()
  await expect(page).toHaveURL(/\/community\/post-/)
  await expect(page.getByRole('button', { name: '使用这个行程' })).toBeVisible()
  await page.getByRole('button', { name: '喜欢' }).click()
  await page.getByRole('button', { name: '收藏' }).click()
  await expect(page.getByRole('button', { name: '喜欢' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '收藏' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '评论' }).click()
  await page.getByPlaceholder('写下评论').fill('准备按这条路线走')
  await page.getByRole('button', { name: '发送评论' }).click()
  await expect(page.getByText('准备按这条路线走')).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: /路线回放/ }).click()
  await expect(page).toHaveURL(/\/replay/)
  await expect(page.locator('.real-route-map')).toBeVisible({ timeout: 12_000 })
  await page.getByRole('button', { name: '跳过回放' }).click()
  await expect(page.getByRole('button', { name: '使用这个行程' })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: '使用这个行程' }).click()
  await expect(page.getByText('尽量保持原路线')).toBeVisible()
  await page.getByRole('button', { name: /尽量保持原路线/ }).click()
  await expect(page).toHaveURL(/\/trips/)
})

test('头像上传后同步到首页和我的', async ({ page }) => {
  await page.goto('/onboarding')
  await page.locator('.avatar-upload input[type="file"]').setInputFiles('public/assets/coffee.jpg')
  await page.getByRole('button', { name: '进入走走' }).click()
  const homeAvatar = page.locator('.avatar-button img')
  await expect(homeAvatar).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: '我', exact: true }).click()
  await expect(page.locator('.profile-intro img')).toHaveAttribute('src', /^blob:/)
})

test('方案地点可局部替换并明确第三方边界', async ({ page }) => {
  await page.goto('/travel/plan/match')
  await page.getByRole('button', { name: '替换', exact: true }).first().click()
  await page.locator('.replacement-list > button').first().click()
  await expect(page.getByRole('status')).toContainText('其他地点没有改变', { timeout: 5_000 })
  await page.getByRole('button', { name: '关闭提示' }).click()
  await page.getByRole('button', { name: '查看说明' }).click()
  await expect(page.getByRole('status')).toContainText('第三方平台')
})

test('开发中心可直达异常和完成状态', async ({ page }) => {
  await page.goto('/__demo')
  await page.getByRole('button', { name: /AI Error/ }).click()
  await expect(page.getByText('这次没有理解完成')).toBeVisible()
  await page.goto('/__demo')
  await page.getByRole('button', { name: /Vote Complete/ }).click()
  await expect(page.getByText('投票结果')).toBeVisible()
  await page.goto('/__demo')
  await page.getByRole('button', { name: /行程偏离/ }).click()
  await expect(page.getByText('路线似乎偏离了')).toBeVisible()
})

test('我的主页切换收藏', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('tab', { name: '收藏' }).click()
  await expect(page.getByRole('button', { name: '我的收藏夹' })).toBeVisible()
  await expect(page.getByText('上海', { exact: true }).first()).toBeVisible()
})

test('真实地图、完整路线与偏离确认', async ({ page }) => {
  await page.goto('/trips')
  await expect(page.locator('.real-route-map')).toBeVisible({ timeout: 12_000 })
  await expect(page.locator('.route-node')).toHaveCount(7, { timeout: 12_000 })
  await page.getByRole('button', { name: '定位' }).click()
  await expect(page.getByText(/离原路线约 260 米/)).toBeVisible()
  await expect(page.getByRole('button', { name: '保持原路线' })).toBeVisible()
  await expect(page.getByRole('button', { name: '从当前位置调整' })).toBeVisible()
  await page.getByRole('button', { name: '保持原路线' }).click()
  await page.goto('/trips?arrival=1')
  await expect(page.getByText(/已到达/)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('武康路', { exact: true }).last()).toBeVisible()
})

for (const width of [320, 375, 414, 768]) {
  test(`首页在 ${width}px 无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 })
    await page.goto('/home')
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
  })
}

test('核心页面没有 console error', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  for (const path of ['/home', '/travel/plans', '/community', '/profile', '/__demo']) {
    await page.goto(path)
    await page.waitForTimeout(250)
  }
  expect(errors).toEqual([])
})

test('iPhone 展示壳在切换 Tab 后仍保留安全区', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/')
  const app = page.frameLocator('iframe[title="走走应用"]')
  await page.waitForTimeout(1_200)
  await app.getByRole('button', { name: '通过 Apple 登录' }).click()
  await app.getByRole('button', { name: '进入走走' }).click()
  await app.getByRole('button', { name: '社区', exact: true }).click()
  await expect(app.locator('.app-shell')).toHaveClass(/is-embedded/)
  const header = await app.locator('.community-header').boundingBox()
  expect(header?.y ?? 0).toBeGreaterThanOrEqual(70)
})

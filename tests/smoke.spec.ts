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
  const cityButton = page.getByRole('button', { name: /上海.*\d+°C/ })
  await expect(cityButton).toBeVisible()
  await cityButton.click()
  await expect(page.getByRole('heading', { name: '热门地点' })).toBeVisible()
  await expect(page.getByText('热门城市', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '关闭' }).click()
  for (const tab of ['首页', '行程', '发现', '我']) await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible()
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
  await expect(page.getByText(/按片区排好，走起来少折返|先按当前信息排好/)).toBeVisible()
  await expect(page.locator('.place-card__source')).toHaveCount(0)
  await expect(page.getByText('虹桥火车站', { exact: true })).toBeVisible()
  await expect(page.getByText('武康路', { exact: true })).toBeVisible()
  await expect(page.getByText('参考的社区攻略', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Day 2' }).click()
  await expect(page.getByText('上海博物馆东馆', { exact: true })).toBeVisible()
})

test('目的地选择器可搜索新增城市并保持滚动列表', async ({ page }) => {
  await page.goto('/travel/new')
  const trigger = page.getByRole('button', { name: '目的地' })
  await trigger.click()
  await expect(page.getByRole('listbox', { name: '目的地列表' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索城市或目的地')).toBeVisible()
  await expect(page.locator('.destination-picker__options')).toHaveCSS('overflow-y', 'auto')
  await page.getByPlaceholder('搜索城市或目的地').fill('林芝')
  await page.getByRole('option', { name: '林芝', exact: true }).click()
  await expect(trigger).toHaveText('林芝')
})

test('方案分页点同步卡片与选中态', async ({ page }) => {
  await page.goto('/travel/plans')
  const dots = page.locator('.plans-dots button')
  await expect(dots).toHaveCount(3)
  await dots.nth(1).click()
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(dots.nth(0)).not.toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.plans-carousel__item').nth(1).locator('button[aria-pressed="true"]')).toBeVisible()
})

test('发现卡片直接进入详情、可互动并可选回放', async ({ page }) => {
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

test('方案地点可局部替换并在行程内选择三档真实住宿', async ({ page }) => {
  await page.goto('/travel/plan/match')
  await page.getByRole('button', { name: '替换', exact: true }).first().click()
  await page.locator('.replacement-list > button').first().click()
  await expect(page.getByRole('status')).toContainText('其他地点没有改变', { timeout: 5_000 })
  await page.getByRole('button', { name: '关闭提示' }).click()
  await page.getByRole('button', { name: '更换酒店' }).click()
  await expect(page.getByRole('heading', { name: '选择住宿' })).toBeVisible()
  await expect(page.locator('.replacement-list > button')).toHaveCount(3)
  await expect(page.locator('.replacement-list > button').first()).not.toContainText('待选')
  await page.locator('.replacement-list > button').first().click()
  await expect(page.getByRole('status')).toContainText('已局部更新', { timeout: 5_000 })
  await expect(page.getByText('第三方查价')).toHaveCount(0)
  await expect(page.getByText('候选待核验')).toHaveCount(0)
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
  await expect(page.getByRole('heading', { name: '还没有收藏路线' })).toBeVisible()
  await expect(page.getByRole('button', { name: '去发现' })).toBeVisible()
})

test('真实地图、完整路线与偏离确认', async ({ page }) => {
  await page.goto('/trips')
  const map = page.locator('.real-route-map')
  await expect(map).toBeVisible({ timeout: 12_000 })
  await expect.poll(async () => {
    const markerCount = await page.locator('.route-node').count()
    const mapLabel = await map.getAttribute('aria-label')
    return markerCount === 7 || Boolean(mapLabel?.includes('地点待确认'))
  }, { timeout: 12_000 }).toBe(true)
  const markerCount = await page.locator('.route-node').count()
  if (markerCount > 0) await expect(page.locator('.route-node')).toHaveCount(7)
  else await expect(map).toHaveAttribute('aria-label', /地点待确认/)
  await page.getByRole('button', { name: '定位' }).click()
  await expect(page.getByText(/尚未获取真实位置|拒绝了定位权限|无法获取当前位置|定位超时|偏离当前路线约 \d+ 米/)).toBeVisible()
  await expect(page.getByRole('button', { name: '保持原路线' })).toBeVisible()
  await expect(page.getByRole('button', { name: '从当前位置调整' })).toBeVisible()
  await page.getByRole('button', { name: '保持原路线' }).click()
  await page.goto('/trips?arrival=1')
  await expect(page.getByText(/已到达/)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('武康路', { exact: true }).last()).toBeVisible()
})

test('切换到南京后，行程主页不会继续显示上海地点', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('zouzou-demo-v2', JSON.stringify({
      state: { city: '南京', tripCity: '南京', activeRouteId: 'route-1', tripMode: 'active' },
      version: 2,
    }))
  })
  await page.goto('/trips')
  await expect(page.locator('.trip-live-header')).toContainText('南京')
  await expect(page.locator('.trip-itinerary')).not.toContainText('上海图书馆')
  await expect(page.locator('.trip-itinerary')).toContainText('中山陵')
})

test('行程页使用高德真实底图，而不是备用世界底图', async ({ page }) => {
  await page.goto('/trips')
  const map = page.locator('.real-route-map')
  await expect(map).toBeVisible({ timeout: 12_000 })
  await expect(map).toHaveAttribute('data-map-provider', 'amap')
  await expect(map).not.toHaveAttribute('aria-label', '地图地点预览，未绘制假路线')
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

test('大屏展示壳仍保留模拟安全区', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 })
  await page.goto('/')
  await expect(page.locator('.ios-status')).toBeVisible()
  await expect(page.locator('.home-indicator')).toBeVisible()
  const app = page.frameLocator('iframe[title="走走应用"]')
  await expect(app.locator('.app-shell')).toHaveClass(/is-embedded/)
  const header = await app.locator('.app-page').boundingBox()
  expect(header?.y ?? 0).toBeGreaterThanOrEqual(70)
})

test('真实手机端不叠加模拟系统栏并从顶部开始渲染', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.ios-status')).toBeHidden()
  await expect(page.locator('.home-indicator')).toBeHidden()

  const app = page.frameLocator('iframe[title="走走应用"]')
  const appPage = app.locator('.app-page')
  await expect(app.locator('.app-shell')).toHaveClass(/is-embedded/)
  await expect(appPage).toHaveCSS('margin-top', '0px')
  const box = await appPage.boundingBox()
  expect(box?.y ?? 999).toBeLessThanOrEqual(1)
})

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { GeneratedPlan } from '../src/services/trip/planner'
import { tripSummary } from '../src/services/trip/summary'

type HomeViewport = [width: number, height: number, fontScale: number]

async function captureHomeLayout(page: Page, testInfo: TestInfo, [width, height, fontScale]: HomeViewport, prefix = 'home') {
  await page.setViewportSize({ width, height })
  await page.goto('/home')
  await expect(page.locator('.home-guide-card__row')).toHaveCount(3)
  await expect(page.getByText('选个目的地，把沿途的吃住玩安排好。', { exact: true })).toHaveCount(0)
  await expect(page.locator('.home-city')).not.toContainText('正在读取天气')
  await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%` }, fontScale)
  const layout = await page.locator('.home-page').evaluate(home => {
    const bounds = home.closest('.app-shell')!.getBoundingClientRect()
    const style = (selector: string) => getComputedStyle(home.querySelector(selector)!)
    return {
      overflow: Array.from(home.querySelectorAll('h1,h2,button,img,.home-resume__copy > *,.home-resume__status')).filter(element => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && (box.left < bounds.left - 1 || box.right > bounds.right + 1)
      }).map(element => ({ tag: element.tagName, className: element.className })),
      botWidth: home.querySelector('.home-travel-card .motion-bot')!.getBoundingClientRect().width,
      guideImageWidth: home.querySelector('.home-guide-card__row img')!.getBoundingClientRect().width,
      titleSize: parseFloat(style('.home-travel-card h1').fontSize),
      guideHeadingSize: parseFloat(style('.home-guides__header h2').fontSize),
      guideTitleSize: parseFloat(style('.home-guide-card__copy strong').fontSize),
      guideBackground: style('.home-guide-card').backgroundColor,
      guideBorderWidth: parseFloat(style('.home-guide-card').borderTopWidth),
      heroWidth: home.querySelector('.home-travel-card')!.getBoundingClientRect().width,
      guideWidth: home.querySelector('.home-guide-card')!.getBoundingClientRect().width,
      heroGap: parseFloat(style('.home-travel-card').rowGap),
      pageGap: parseFloat(getComputedStyle(home).rowGap),
      guideRadius: parseFloat(style('.home-guide-card').borderTopLeftRadius),
      guideShadow: style('.home-guide-card').boxShadow,
      heroShadow: style('.home-travel-card').boxShadow,
    }
  })
  expect(layout.overflow, `${prefix}: ${width}px / ${fontScale * 100}%`).toEqual([])
  expect(layout.botWidth).toBeGreaterThanOrEqual(112)
  expect(layout.botWidth).toBeLessThanOrEqual(128)
  expect(layout.botWidth).toBeGreaterThan(layout.guideImageWidth * 2)
  expect(layout.titleSize).toBeGreaterThan(layout.guideHeadingSize)
  expect(layout.titleSize).toBeGreaterThan(layout.guideTitleSize)
  expect(layout.guideBackground).toBe('rgb(255, 255, 255)')
  expect(layout.guideBorderWidth).toBe(0)
  expect(layout.guideWidth - layout.heroWidth).toBeCloseTo(12, 0)
  expect(layout.heroGap).toBe(12)
  expect(layout.pageGap).toBe(16)
  expect(layout.guideRadius).toBeGreaterThanOrEqual(16)
  expect(layout.guideShadow).not.toBe('none')
  expect(layout.heroShadow).not.toBe('none')
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-${width}-${fontScale * 100}.png`), animations: 'disabled' })
}

test('首页只保留一个旅行入口和三条城市攻略，Bot 仍可互动', async ({ page }) => {
  await page.goto('/home')
  await expect(page.locator('.home-travel-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '开始规划旅行' })).toBeVisible()
  await expect(page.locator('.entry-card')).toHaveCount(0)
  for (const label of ['周末', '约会', '聚餐']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }
  await expect(page.locator('.home-guide-card__row')).toHaveCount(3)
  const bot = page.locator('.home-travel-card .motion-bot')
  await expect(bot).toHaveAttribute('data-bot-interactive', 'true')
  await bot.click()
  await expect(bot).toHaveClass(/is-reacting/)
  await page.getByRole('button', { name: '开始规划旅行' }).click()
  await expect(page).toHaveURL(/\/travel\/new$/)
  await expect(page.getByRole('button', { name: '目的地', exact: true })).toBeVisible()
})

test('三个旧链接进入旅行，后端不再接受这三类新计划', async ({ page, request }) => {
  for (const type of ['weekend', 'date', 'dining']) {
    await page.goto(`/${type}`)
    await expect(page).toHaveURL(/\/travel\/new$/)
    await expect(page.getByRole('button', { name: '帮我看看' })).toBeVisible()
    const response = await request.post('/api/group-plans', { data: { type } })
    expect(response.status()).toBe(410)
    expect(await response.json()).toEqual({ error: 'FEATURE_REMOVED', message: '此功能已下线，请使用旅行规划。' })
  }
  const travel = await request.post('/api/group-plans', { data: { type: 'travel' } })
  expect(travel.status()).toBe(400)
  expect((await travel.json()).error).toBe('INVALID_INPUT')
  const health = await request.get('/api/health')
  expect(health.ok()).toBeTruthy()
})

test('切换城市后攻略卡与全部入口指向该城市的真实内容', async ({ page }) => {
  await page.goto('/home')
  const original = await page.locator('.home-guide-card__copy strong').allTextContents()
  await page.locator('.home-city').click()
  await page.getByRole('button', { name: '成都', exact: true }).click()
  await expect(page.getByRole('heading', { name: '在成都，你可能喜欢' })).toBeVisible()
  const recommendations = page.locator('.home-guide-card__row')
  await expect(recommendations).toHaveCount(3)
  expect(await page.locator('.home-guide-card__copy strong').allTextContents()).not.toEqual(original)
  const title = await recommendations.first().locator('strong').innerText()
  await recommendations.first().click()
  await expect(page).toHaveURL(/\/discover\//)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.goto('/home')
  await page.getByRole('button', { name: '查看成都全部攻略' }).click()
  await expect(page).toHaveURL(/\/discover\/cities\/(成都|%E6%88%90%E9%83%BD)$/)
})

test('旅行从首页生成三套方案、保存，并可从首页继续同一行程', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('/home')
  await page.getByRole('button', { name: '开始规划旅行' }).click()
  await page.getByRole('button', { name: '目的地', exact: true }).click()
  await page.getByRole('option', { name: '上海', exact: true }).click()
  await page.getByLabel('旅行天数', { exact: true }).fill('2')
  await page.getByLabel('出行人数', { exact: true }).fill('2')
  await page.getByLabel('旅行想法', { exact: true }).fill('2026年10月2日去上海，2人旅行2天，总预算6000元，想去外滩、武康路，轻松散步。10月2日10点到虹桥火车站，10月3日18点从虹桥火车站离开，住静安寺附近。')
  await page.getByRole('button', { name: '帮我看看' }).click()
  await expect(page).toHaveURL(/\/travel\/plans$/, { timeout: 75_000 })
  await expect(page.locator('.plans-stack__item')).toHaveCount(3)
  await page.getByRole('button', { name: '查看这套走法' }).first().click()
  await page.getByRole('button', { name: '选用并保存', exact: true }).click()
  await expect(page).toHaveURL(/\/trips\//)
  const savedUrl = page.url()
  const stored = await page.evaluate(() => localStorage.getItem('zouzou-saved-plans-v1'))
  expect(stored).not.toBeNull()
  const savedPlans = (JSON.parse(stored!) as { value: GeneratedPlan[] }).value
  const savedPlan = savedPlans.find(plan => savedUrl.endsWith(`/trips/${plan.tripId}`))
  expect(savedPlan).toBeDefined()
  const summary = tripSummary(savedPlan!)
  await page.goto('/home')
  await expect(page.locator('.home-resume')).toContainText('继续行程')
  await page.reload()
  await expect(page.locator('.home-resume')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('zouzou-saved-plans-v1'))).toBe(stored)
  await page.locator('.home-resume').click()
  await expect(page).toHaveURL(savedUrl)
  const viewports: HomeViewport[] = [[390, 844, 1], [320, 812, 1], [1280, 900, 1], [390, 844, 2]]
  for (const viewport of viewports) {
    await captureHomeLayout(page, testInfo, viewport, 'home-saved')
    const resume = page.locator('.home-resume')
    await expect(resume.locator('.home-resume__header')).toContainText('继续行程')
    await expect(resume.locator('.home-resume__status')).toHaveText(summary.status)
    await expect(resume.locator('.home-resume__status')).toBeVisible()
    await expect(resume.locator('.home-resume__copy strong')).toHaveText(summary.title)
    await expect(resume.locator('.home-resume__copy strong')).toBeVisible()
    await expect(resume.locator('.home-resume__copy small')).toHaveText(summary.dates)
    await expect(resume.locator('.home-resume__copy small')).toBeVisible()
    const typography = await resume.evaluate(element => ({
      title: parseFloat(getComputedStyle(element.querySelector('strong')!).fontSize),
      dates: parseFloat(getComputedStyle(element.querySelector('small')!).fontSize),
    }))
    expect(typography.title).toBeGreaterThan(typography.dates)
    if (viewport[2] === 2) {
      await resume.scrollIntoViewIfNeeded()
      await expect(resume).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath('home-saved-390-200-resume.png'), animations: 'disabled' })
    }
    await resume.focus()
    await expect(resume).toBeFocused()
    await resume.press('Enter')
    await expect(page).toHaveURL(savedUrl)
  }
  expect(await page.evaluate(() => localStorage.getItem('zouzou-saved-plans-v1'))).toBe(stored)
})

test('首页在手机、桌面和大字体下保持单卡布局且无横向溢出', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const viewports: HomeViewport[] = [[320, 812, 1], [390, 844, 1], [430, 932, 1], [1280, 900, 1], [390, 844, 2]]
  for (const viewport of viewports) {
    await captureHomeLayout(page, testInfo, viewport)
    await expect(page.locator('.home-resume')).toHaveCount(0)
    await page.locator('.home-guide-card__row').last().scrollIntoViewIfNeeded()
    await expect(page.locator('.home-guide-card__row').last()).toBeInViewport()
    if (viewport[2] === 2) await page.screenshot({ path: testInfo.outputPath('home-390-200-bottom.png'), animations: 'disabled' })
  }
  expect(errors).toEqual([])
})

import { expect, test } from '@playwright/test'

test.describe('group plan creation surfaces', () => {
  for (const path of ['weekend', 'date', 'dining']) {
    test(`${path} creation is usable on mobile`, async ({ page }, testInfo) => {
      await page.goto(`/${path}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('button', { name: /生成/ })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`${path}-create.png`), fullPage: true, animations: 'disabled' })
    })
  }
})

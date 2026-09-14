import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Keep browser checks serial so page.goto remains deterministic on a
  // constrained local runtime.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 402, height: 874 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})

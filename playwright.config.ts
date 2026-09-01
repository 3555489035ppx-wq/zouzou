import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // MapLibre and the local Vite server share one constrained browser/runtime
  // budget. Serial workers keep page.goto deterministic instead of making a
  // dozen simultaneous tile/worker requests look like product timeouts.
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

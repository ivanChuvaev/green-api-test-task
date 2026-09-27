import { defineConfig, devices } from '@playwright/test'

// Playwright can't parse a CIDR `no_proxy=127.0.0.1/8` and would send the readiness
// probe through the proxy, so the loopback names are listed explicitly.
for (const variable of ['NO_PROXY', 'no_proxy']) {
  const current = process.env[variable] ?? ''
  const hosts = ['localhost', '127.0.0.1']
  process.env[variable] = [current, ...hosts].filter(Boolean).join(',')

  process.env[variable] = process.env[variable].replace('127.0.0.1/8', '')
}

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run build && pnpm run preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
  },
})

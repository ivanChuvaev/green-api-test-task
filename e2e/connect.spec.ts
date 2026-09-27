import { expect, test } from '@playwright/test'
import { chatCount, connect } from './actions'
import { credentials, isConfigured, missingVariables } from './env'

test.skip(
  !isConfigured,
  `Fill in ${missingVariables.join(', ')} in .env (see .env.example) to run the end-to-end tests`,
)

test.describe('sign in', () => {
  test('opens the workspace with the credentials from .env', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Мессенджер' })).toBeVisible()

    await connect(page)

    await expect(page.getByTitle('Новый чат')).toBeVisible()
    await expect(page.getByLabel('Поиск чатов')).toBeVisible()
    await expect(chatCount(page)).toBeVisible()
  })

  test('shows an error and stays on the login screen with a wrong token', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('apiUrl').fill(credentials.apiUrl)
    await page.getByPlaceholder('000000000000').fill(credentials.idInstance)
    await page.getByLabel('apiTokenInstance').fill('definitely-not-a-valid-token')
    await page.getByRole('button', { name: 'Подключиться' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Мессенджер' })).toBeVisible()
  })

  test('validates the instance number before calling the API', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('apiUrl').fill(credentials.apiUrl)
    await page.getByPlaceholder('000000000000').fill('abc')
    await page.getByRole('button', { name: 'Подключиться' }).click()

    await expect(page.getByRole('alert')).toContainText('idInstance')
  })
})

test.describe('bundle', () => {
  test('never ships the instance token to the browser', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const entry = html.match(/src="([^"]+\.js)"/)?.[1]

    expect(entry, 'the built index.html should reference a JS bundle').toBeTruthy()

    const bundle = await (await request.get(entry as string)).text()
    expect(bundle).not.toContain('E2E_GREEN_API_TOKEN')
    expect(bundle).not.toContain(credentials.apiTokenInstance)
  })
})

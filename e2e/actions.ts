import { expect, type Page } from '@playwright/test'
import { credentials } from './env'

export const chatCount = (page: Page) =>
  page.getByText(/^(Нет активных чатов|\d+ (чат|чата|чатов))$/)

export const connect = async (page: Page) => {
  await page.getByLabel('apiUrl').fill(credentials.apiUrl)
  await page.getByPlaceholder('000000000000').fill(credentials.idInstance)
  await page.getByLabel('apiTokenInstance').fill(credentials.apiTokenInstance)
  await page.getByRole('button', { name: 'Подключиться' }).click()

  await expect(page.getByPlaceholder('Поиск чатов')).toBeVisible()

  await expect(
    chatCount(page)
      .or(page.getByRole('button', { name: 'Включить' }))
      .or(page.getByRole('button', { name: 'Повторить' })),
  ).toBeVisible({ timeout: 30_000 })

  const enable = page.getByRole('button', { name: 'Включить' })
  if (await enable.isVisible()) {
    await enable.click()
    await expect(chatCount(page)).toBeVisible({ timeout: 30_000 })
  }
}

export const openChatWith = async (page: Page, target: string) => {
  await page.getByTitle('Новый чат').click()
  await page.getByPlaceholder('Телефон или имя пользователя').fill(target)
  await page.getByRole('button', { name: 'Поиск' }).click()

  await expect(page.getByRole('button', { name: 'Поиск' })).toBeHidden({ timeout: 30_000 })
}

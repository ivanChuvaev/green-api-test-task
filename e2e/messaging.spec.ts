import { expect, test, type Page } from '@playwright/test'
import { chatCount, connect, openChatWith } from './actions'
import { isConfigured, missingVariables, recipientPhone } from './env'

test.skip(
  !isConfigured,
  `Fill in ${missingVariables.join(', ')} in .env (see .env.example) to run the end-to-end tests`,
)

const outgoing = '[data-testid="message"][data-direction="out"]'
const incoming = '[data-testid="message"][data-direction="in"]'

const composer = (page: Page) => page.getByRole('textbox', { name: 'Напишите сообщение…' })

test.describe('messaging end to end', () => {
  test('finds an account by phone number and opens it without adding a chat', async ({ page }) => {
    await page.goto('/')
    await connect(page)
    const before = await chatCount(page).textContent()

    await openChatWith(page, recipientPhone)

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(`+${recipientPhone}`).first()).toBeVisible()
    await expect(page.getByText('Контакт')).toBeVisible()
    await expect(chatCount(page)).toHaveText(before ?? '')

    await expect(composer(page)).toBeEditable()
    await composer(page).fill('проверка')
    await expect(page.getByTitle('Отправить (Enter)')).toBeEnabled()
  })

  test('focuses the editor on a click in the insets and in the corners of the field', async ({
    page,
  }) => {
    await page.goto('/')
    await connect(page)
    await openChatWith(page, recipientPhone)

    const field = composer(page)
    const box = await field.boundingBox()
    if (!box) throw new Error('the composer field has no box')

    const points = [
      { x: box.x + 2, y: box.y + 2 },
      { x: box.x + 2, y: box.y + box.height / 2 },
      { x: box.x + box.width - 2, y: box.y + box.height - 2 },
    ]

    for (const point of points) {
      await field.fill('')
      await page.mouse.click(point.x, point.y)
      await page.keyboard.type('проверка')

      await expect(field).toHaveText('проверка')
    }

    await expect(page.getByTitle('Отправить (Enter)')).toBeEnabled()
  })

  test('rejects a phone number without an account in the messenger', async ({ page }) => {
    await page.goto('/')
    await connect(page)
    await page.getByTitle('Новый чат').click()
    await page.getByPlaceholder('Телефон или имя пользователя').fill('10000000000')
    await page.getByRole('button', { name: 'Поиск' }).click()

    await expect(page.getByRole('alert')).toContainText('не найден')
    await expect(page.getByRole('button', { name: 'Поиск' })).toBeVisible()
  })

  test('sends a text message and shows it in the chat', async ({ page }) => {
    const text = `E2E ${new Date().toISOString().slice(11, 19)}`

    await page.goto('/')
    await connect(page)
    await openChatWith(page, recipientPhone)

    await composer(page).fill(text)
    await composer(page).press('Enter')

    const bubble = page.locator(outgoing, { hasText: text })
    await expect(bubble).toBeVisible({ timeout: 30_000 })
    await expect(bubble.getByTitle(/Отправлено|Доставлено|Прочитано/)).toBeVisible()
    await expect(composer(page)).toHaveText('')
    await expect(page.locator('[data-active]', { hasText: text })).toHaveCount(1)
  })

  test('refuses to send a message longer than the messenger limit', async ({ page }) => {
    await page.goto('/')
    await connect(page)
    await openChatWith(page, recipientPhone)

    await composer(page).fill('x'.repeat(4_200))

    await expect(page.getByText('-104')).toBeVisible()
    await expect(page.getByTitle('Отправить (Enter)')).toBeDisabled()
  })

  test('shows the chat list alone when no chat is selected', async ({ page }) => {
    await page.goto('/')
    await connect(page)

    await expect(chatCount(page)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Напишите сообщение…' })).toBeHidden()
    await expect(page.getByTitle('Отправить (Enter)')).toBeHidden()
    await expect(page.getByText('Контакт')).toBeHidden()
  })

  test('returns to the chat list on Escape', async ({ page }) => {
    await page.goto('/')
    await connect(page)
    await openChatWith(page, recipientPhone)

    await expect(composer(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(composer(page)).toBeHidden()
    await expect(chatCount(page)).toBeVisible()
  })

  test.fixme('a reply is typed by a human in the messenger app, so it cannot be automated', async ({
    page,
  }) => {
    await page.goto('/')
    await connect(page)
    await openChatWith(page, recipientPhone)

    await expect(page.locator(incoming)).toBeVisible({ timeout: 120_000 })
  })
})

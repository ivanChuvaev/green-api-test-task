import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TARGET_NOT_FOUND_MESSAGE } from '../hooks/useMessenger'
import { NewChatModal } from './NewChatModal'

const field = () => screen.getByPlaceholderText('Телефон или имя пользователя')
const find = () => screen.getByRole('button', { name: 'Поиск' })

describe('NewChatModal', () => {
  it('validates the phone number and username before calling the API', async () => {
    const user = userEvent.setup()
    const onFind = vi.fn()
    render(<NewChatModal onClose={vi.fn()} onFind={onFind} />)

    await user.type(field(), '123')
    await user.click(find())

    expect(await screen.findByRole('alert')).toHaveTextContent('+7 (000) 000-00-00')
    expect(await screen.findByRole('alert')).toHaveTextContent('@username')
    expect(onFind).not.toHaveBeenCalled()

    await user.clear(field())
    await user.type(field(), '@abc')
    await user.click(find())

    expect(await screen.findByRole('alert')).toHaveTextContent('@username')
    expect(onFind).not.toHaveBeenCalled()
  })

  it('looks an account up by a formatted number or by a username', async () => {
    const user = userEvent.setup()
    const onFind = vi.fn().mockResolvedValue(undefined)
    render(<NewChatModal onClose={vi.fn()} onFind={onFind} />)

    await user.type(field(), '+7 (999) 123-45-67')
    await user.click(find())
    await waitFor(() => expect(onFind).toHaveBeenCalledWith('+7 (999) 123-45-67'))

    await user.clear(field())
    const username = `@${'a'.repeat(32)}`
    await user.type(field(), username)
    await user.click(find())
    await waitFor(() => expect(onFind).toHaveBeenCalledWith(username))
  })

  it('keeps the dialog open and shows that no such account exists', async () => {
    const user = userEvent.setup()
    const onFind = vi.fn().mockRejectedValue(new Error(TARGET_NOT_FOUND_MESSAGE))
    const onClose = vi.fn()
    render(<NewChatModal onClose={onClose} onFind={onFind} />)

    await user.type(field(), '79991234567')
    await user.click(find())

    expect(await screen.findByRole('alert')).toHaveTextContent('не найден')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on the cancel button, on the backdrop and on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<NewChatModal onClose={onClose} onFind={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    await user.click(screen.getByRole('dialog').firstElementChild as HTMLElement)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

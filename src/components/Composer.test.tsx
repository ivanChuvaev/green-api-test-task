import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_MESSAGE_LENGTH } from '../api/greenApi'
import { Composer } from './Composer'

const field = (name = 'Сообщение') => screen.getByRole('textbox', { name })
const sendButton = () => screen.getByTitle('Отправить (Enter)')

const paste = (text: string) => fireEvent.paste(field(), { clipboardData: { getData: () => text } })

describe('Composer', () => {
  it('focuses the editor on a click, so the insets of the field are clickable', async () => {
    const user = userEvent.setup()
    render(<Composer onSend={vi.fn().mockResolvedValue(undefined)} />)

    await user.click(field())

    expect(field()).toHaveFocus()
    await user.keyboard('привет')
    expect(sendButton()).toBeEnabled()
  })

  it('focuses the editor on a click on the wrapper around the editable area', async () => {
    const user = userEvent.setup()
    render(<Composer onSend={vi.fn().mockResolvedValue(undefined)} />)
    const wrapper = field().parentElement
    if (!wrapper) throw new Error('the editor has no wrapper')

    await user.click(wrapper)

    expect(field()).toHaveFocus()
    await user.keyboard('привет')
    expect(sendButton()).toBeEnabled()
  })

  it('sends the trimmed text on Enter and clears the field', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    await user.type(field(), '  привет  {Enter}')

    expect(onSend).toHaveBeenCalledWith('привет')
    expect(field().textContent).toBe('')
  })

  it('keeps the newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    await user.type(field(), 'строка 1{Shift>}{Enter}{/Shift}строка 2')

    expect(onSend).not.toHaveBeenCalled()
    expect(field()).toHaveTextContent('строка 1')
    expect(field().querySelectorAll('p')).toHaveLength(2)
  })

  it('sends with the button and ignores an empty message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    expect(sendButton()).toBeDisabled()

    await user.type(field(), 'привет')
    await user.click(sendButton())

    expect(onSend).toHaveBeenCalledWith('привет')
  })

  it('keeps the field free for the next message while one is in flight', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn(() => new Promise<void>(() => {}))
    render(<Composer onSend={onSend} />)

    await user.type(field(), 'первое{Enter}второе')

    expect(onSend).toHaveBeenCalledWith('первое')
    expect(field()).toHaveTextContent('второе')
  })

  it('puts a refused message back into the field', async () => {
    const user = userEvent.setup()
    render(<Composer onSend={vi.fn().mockRejectedValue(new Error('HTTP 400'))} />)

    await user.type(field(), 'привет{Enter}')

    await waitFor(() => expect(field()).toHaveTextContent('привет'))
  })

  it('does not send a message over the limit of the messenger', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    paste('x'.repeat(MAX_MESSAGE_LENGTH + 4))
    await user.keyboard('{Enter}')

    expect(screen.getByText('-4')).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('counts the characters left when the message gets close to the limit', () => {
    render(<Composer onSend={vi.fn().mockResolvedValue(undefined)} />)

    paste('x'.repeat(MAX_MESSAGE_LENGTH - 96))

    expect(screen.getByText('96')).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MessageEditor, type MessageEditorHandle } from './MessageEditor'

interface HarnessProps {
  onSubmit?: () => void
}

const Harness = ({ onSubmit = () => {} }: HarnessProps) => {
  const [text, setText] = useState('')
  const handle = useRef<MessageEditorHandle>(null)

  return (
    <>
      <span data-testid="text">{text}</span>
      <button type="button" onClick={() => handle.current?.clear()}>
        Очистить
      </button>
      <MessageEditor
        ref={handle}
        placeholder="Напишите сообщение…"
        onChange={setText}
        onSubmit={onSubmit}
      />
    </>
  )
}

const field = () => screen.getByRole('textbox', { name: 'Напишите сообщение…' })
const value = () => screen.getByTestId('text').textContent

describe('MessageEditor', () => {
  it('focuses the editable area on a click and sends the keystrokes into it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('привет')

    expect(field()).toHaveFocus()
    expect(value()).toBe('привет')
  })

  it('reports the typed text on every change', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(field(), 'привет')

    expect(value()).toBe('привет')
  })

  it('submits on Enter instead of adding a line', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await user.type(field(), 'привет{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(value()).toBe('привет')
  })

  it('keeps the line break of Shift+Enter in the text', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await user.type(field(), 'строка 1{Shift>}{Enter}{/Shift}строка 2')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(value()).toBe('строка 1\nстрока 2')
  })

  it('pastes the plain text of the clipboard and drops its markup', () => {
    render(<Harness />)

    fireEvent.paste(field(), {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? '**привет**' : '<b>**привет**</b>'),
      },
    })

    expect(value()).toBe('**привет**')
    expect(field().querySelector('b')).toBeNull()
  })

  it('empties the document on clear()', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(field(), 'привет')

    await user.click(screen.getByRole('button', { name: 'Очистить' }))

    expect(value()).toBe('')
  })
})

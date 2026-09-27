import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Chat, ChatMessage } from '../api/types'
import { contact, contactName, contactPhone } from '../test/fixtures'
import { HISTORY_LIMIT } from '../hooks/useMessenger'
import { MessageList } from './MessageList'

const chat: Chat = {
  chatId: contact.chatId,
  title: contactName,
  phone: contactPhone,
  avatar: '',
  unread: 0,
  lastActivity: Date.parse('2026-09-25T15:40:00Z'),
  lastMessage: '',
  lastStatus: null,
}

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(13, 0, 0, 0)
  return date.getTime()
}

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: '1',
  chatId: chat.chatId,
  text: 'Текст',
  direction: 'in',
  timestamp: Date.parse('2026-09-25T15:40:00Z'),
  status: 'read',
  ...overrides,
})

describe('MessageList', () => {
  it('invites to start a conversation when the chat is empty', () => {
    render(<MessageList messages={[]} chat={chat} />)

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.getByText(/Отправьте первое сообщение/)).toBeInTheDocument()
  })

  it('reports that the history of the chat is still loading', () => {
    render(<MessageList messages={[]} chat={chat} loading />)

    expect(screen.getByText('Загружаем историю сообщений…')).toBeInTheDocument()
  })

  it('separates messages of different days', () => {
    render(
      <MessageList
        messages={[
          message({ id: '1', timestamp: daysAgo(0) }),
          message({ id: '2', timestamp: daysAgo(1) }),
        ]}
        chat={chat}
      />,
    )

    expect(screen.getByText('Сегодня')).toBeInTheDocument()
    expect(screen.getByText('Вчера')).toBeInTheDocument()
  })

  it('marks an outgoing message as sent and a read one with a double check', () => {
    const { rerender } = render(
      <MessageList
        messages={[message({ id: '1', direction: 'out', status: 'sent' })]}
        chat={chat}
      />,
    )

    expect(screen.getByTitle('Отправлено')).toBeInTheDocument()

    rerender(
      <MessageList
        messages={[message({ id: '1', direction: 'out', status: 'read' })]}
        chat={chat}
      />,
    )

    expect(screen.getByTitle('Прочитано')).toBeInTheDocument()
  })

  it('shows a warning for a failed and a clock for a pending message', () => {
    const { rerender } = render(
      <MessageList
        messages={[message({ id: '1', direction: 'out', status: 'failed' })]}
        chat={chat}
      />,
    )

    expect(screen.getByTitle('Не отправлено')).toBeInTheDocument()

    rerender(
      <MessageList
        messages={[message({ id: '1', direction: 'out', status: 'pending' })]}
        chat={chat}
      />,
    )

    expect(screen.getByTitle('Отправляется')).toBeInTheDocument()
  })

  it('keeps line breaks in the message text', () => {
    render(<MessageList messages={[message({ id: '1', text: 'первая\nвторая' })]} chat={chat} />)

    expect(screen.getByText('первая вторая')).toBeInTheDocument()
  })

  it('makes the web links of a message clickable', () => {
    render(<MessageList messages={[message({ text: 'см. https://green-api.com.' })]} chat={chat} />)

    expect(screen.getByRole('link', { name: 'https://green-api.com' })).toHaveAttribute(
      'href',
      'https://green-api.com',
    )
  })

  it('names the kind of a media message it cannot show', () => {
    render(<MessageList messages={[message({ text: 'отпуск', attachment: 'Фото' })]} chat={chat} />)

    expect(screen.getByText('Фото')).toBeInTheDocument()
    expect(screen.getByText('отпуск')).toBeInTheDocument()
  })

  it('tells that older messages may be missing only after a full page of history', () => {
    const page = (length: number) =>
      Array.from({ length }, (_, index) => message({ id: `m${index}` }))
    const notice = () => screen.queryByText(new RegExp(`последние ${HISTORY_LIMIT}`))

    const { rerender } = render(<MessageList messages={page(3)} chat={chat} />)
    expect(notice()).not.toBeInTheDocument()

    rerender(<MessageList messages={page(HISTORY_LIMIT)} chat={chat} />)
    expect(notice()).toBeInTheDocument()
  })

  it('shows the history that arrives after the empty state', () => {
    const { rerender } = render(<MessageList messages={[]} chat={chat} loading />)

    rerender(<MessageList messages={[message({ text: 'Привет' })]} chat={chat} />)

    expect(screen.getByText('Привет')).toBeInTheDocument()
  })

  it('renders a window of the rows of a long chat instead of the whole history', () => {
    const messages = Array.from({ length: 500 }, (_, index) =>
      message({ id: `m${index}`, text: `Сообщение ${index}` }),
    )

    render(<MessageList messages={messages} chat={chat} />)

    const rows = screen.getAllByTestId('message')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(messages.length)
  })

  it('opens a long chat on its latest messages, not on the oldest ones', () => {
    const messages = Array.from({ length: 500 }, (_, index) =>
      message({ id: `m${index}`, text: `Сообщение ${index}` }),
    )

    const { rerender } = render(<MessageList messages={messages} chat={chat} />)

    expect(screen.getByText('Сообщение 499')).toBeInTheDocument()
    expect(screen.queryByText('Сообщение 0')).not.toBeInTheDocument()

    const other = { ...chat, chatId: `${chat.chatId}-other` }
    const otherMessages = messages.map((item) => ({
      ...item,
      id: `o${item.id}`,
      text: `Другой ${item.id}`,
    }))
    rerender(<MessageList messages={otherMessages} chat={other} />)

    expect(screen.getByText('Другой m499')).toBeInTheDocument()
    expect(screen.queryByText('Другой m0')).not.toBeInTheDocument()
  })

  it('gives the row box the height of the pane, so a short chat sits at the bottom', () => {
    const { container } = render(<MessageList messages={[message({})]} chat={chat} />)

    const list = container.firstElementChild
    expect(list?.firstElementChild).toHaveStyle({ height: '600px' })
  })
})

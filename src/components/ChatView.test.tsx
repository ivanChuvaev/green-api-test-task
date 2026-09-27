import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Chat, ChatMessage } from '../api/types'
import { contact, contactName, contactPhone } from '../test/fixtures'
import { ChatView } from './ChatView'

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

const message: ChatMessage = {
  id: '1',
  chatId: chat.chatId,
  text: 'Проверка отправки',
  direction: 'in',
  timestamp: Date.parse('2026-09-25T15:40:00Z'),
  status: 'read',
}

const createProps = (overrides: Partial<React.ComponentProps<typeof ChatView>> = {}) => ({
  chat,
  messages: [message],
  loading: false,
  connection: 'online' as const,
  onBack: vi.fn(),
  onOpenProfile: vi.fn(),
  onSend: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

const renderChatView = (overrides: Partial<React.ComponentProps<typeof ChatView>> = {}) => {
  const props = createProps(overrides)
  return { props, ...render(<ChatView {...props} />) }
}

describe('ChatView', () => {
  it('shows the header, the messages and the composer of the selected chat', () => {
    renderChatView()

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.getByText('Проверка отправки')).toBeInTheDocument()
    expect(screen.getByLabelText('Напишите сообщение…')).toBeInTheDocument()
  })

  it('keeps the pane in the grid but empty while no chat is selected', () => {
    const { container } = renderChatView({ chat: null, messages: [] })

    const pane = container.querySelector('main[data-pane="chatView"]')
    expect(pane).toBeInTheDocument()
    expect(pane?.className).toMatch(/chatViewEmpty/)
    expect(pane).toHaveTextContent('Выберите чат или начните новый')
    expect(screen.queryByLabelText('Напишите сообщение…')).not.toBeInTheDocument()
  })

  it('drops the empty modifier once a chat is selected', () => {
    const { container } = renderChatView()

    const pane = container.querySelector('main[data-pane="chatView"]')
    expect(pane?.className).not.toMatch(/chatViewEmpty/)
  })

  it('reports the way back to the list of chats', async () => {
    const user = userEvent.setup()
    const { props } = renderChatView()

    await user.click(screen.getByTitle('К списку чатов'))

    expect(props.onBack).toHaveBeenCalled()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Chat } from '../api/types'
import { TEST_AVATAR_URL, account, contact, contactName, contactPhone } from '../test/fixtures'
import { formatPhone } from '../utils/format'
import { ChatList } from './ChatList'

const accountName = 'Мой аккаунт'

const chats: Chat[] = [
  {
    chatId: contact.chatId,
    title: contactName,
    phone: contactPhone,
    avatar: '',
    unread: 0,
    lastActivity: Date.parse('2026-09-25T15:40:00Z'),
    lastMessage: 'Проверка отправки',
    lastStatus: 'read',
  },
  {
    chatId: '100500',
    title: 'Поддержка',
    phone: '79991234567',
    avatar: '',
    unread: 3,
    lastActivity: Date.parse('2026-09-25T16:10:00Z'),
    lastMessage: 'Ваш вопрос',
    lastStatus: 'sent',
  },
]

const createProps = (overrides: Partial<React.ComponentProps<typeof ChatList>> = {}) => ({
  chats,
  activeChatId: null,
  onSelect: vi.fn(),
  onNewChat: vi.fn(),
  accountTitle: accountName,
  accountPhone: formatPhone(account.phone),
  accountAvatarUrl: '',
  onLogout: vi.fn(),
  ...overrides,
})

const renderChatList = (overrides: Partial<React.ComponentProps<typeof ChatList>> = {}) => {
  const props = createProps(overrides)
  return { props, ...render(<ChatList {...props} />) }
}

const typeQuery = async (user: ReturnType<typeof userEvent.setup>, query: string) =>
  user.type(screen.getByLabelText('Поиск чатов'), query)

describe('ChatList', () => {
  it('lists the chats with their last message', () => {
    renderChatList()

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.getByText('Проверка отправки')).toBeInTheDocument()
    expect(screen.getByText('2 чата')).toBeInTheDocument()
  })

  it('shows the unread counter and marks the active chat', () => {
    renderChatList({ activeChatId: contact.chatId })

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(contactName).closest('button')).toHaveAttribute('data-active', 'true')
  })

  it('shows the status of the previewed message next to it', () => {
    renderChatList()

    expect(screen.getByTitle('Прочитано')).toBeInTheDocument()
    expect(screen.getByTitle('Отправлено')).toBeInTheDocument()
  })

  it('shows no status when the previewed message is an incoming one', () => {
    const incoming: Chat[] = [{ ...chats[0], lastStatus: null }]
    renderChatList({ chats: incoming })

    expect(screen.queryByTitle('Прочитано')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Отправлено')).not.toBeInTheDocument()
  })

  it('reports the selected chat', async () => {
    const user = userEvent.setup()
    const { props } = renderChatList()

    await user.click(screen.getByText('Поддержка').closest('button')!)

    expect(props.onSelect).toHaveBeenCalledWith('100500')
  })

  it('keeps the typed query in the field and filters the rows by it', async () => {
    const user = userEvent.setup()
    const { container } = renderChatList()

    await typeQuery(user, 'под')

    expect(screen.getByLabelText('Поиск чатов')).toHaveValue('под')
    expect(container.querySelectorAll('[data-active]')).toHaveLength(1)
    expect(screen.getByText('Поддержка')).toBeInTheDocument()
    expect(screen.queryByText(contactName)).not.toBeInTheDocument()
    expect(screen.getByText('Найдено 1 из 2')).toBeInTheDocument()
  })

  it('finds a chat by a digit of its number, whatever the formatting', async () => {
    const user = userEvent.setup()
    renderChatList()

    await typeQuery(user, '999 123')

    expect(screen.getByText('Поддержка')).toBeInTheDocument()
    expect(screen.queryByText(contactName)).not.toBeInTheDocument()
  })

  it('finds a chat by the preview of its last message', async () => {
    const user = userEvent.setup()
    renderChatList()

    await typeQuery(user, 'вопрос')

    expect(screen.getByText('Поддержка')).toBeInTheDocument()
    expect(screen.queryByText(contactName)).not.toBeInTheDocument()
  })

  it('keeps the whole list for a blank query', async () => {
    const user = userEvent.setup()
    const { container } = renderChatList()

    await typeQuery(user, '   ')

    expect(container.querySelectorAll('[data-active]')).toHaveLength(chats.length)
    expect(screen.getByText('2 чата')).toBeInTheDocument()
  })

  it('reports an empty result of its own, without inviting a new chat', async () => {
    const user = userEvent.setup()
    renderChatList()

    await typeQuery(user, 'нет-такого')

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.getByText('Найдено 0 из 2')).toBeInTheDocument()
    expect(screen.queryByText('Здесь появятся ваши диалоги')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Начать новый чат' })).not.toBeInTheDocument()
  })

  it('invites a new chat rather than reporting an empty result while the store is empty', async () => {
    const user = userEvent.setup()
    renderChatList({ chats: [] })

    await typeQuery(user, 'под')

    expect(screen.getByText('Здесь появятся ваши диалоги')).toBeInTheDocument()
    expect(screen.queryByText('Ничего не найдено')).not.toBeInTheDocument()
  })

  it('does not count the empty result as a window of the virtualized list', async () => {
    const user = userEvent.setup()
    const { container } = renderChatList()

    await typeQuery(user, 'нет-такого')

    expect(container.querySelectorAll('[data-active]')).toHaveLength(0)
  })

  it('clears the query on demand and puts the caret back in the field', async () => {
    const user = userEvent.setup()
    const { container } = renderChatList()

    await typeQuery(user, 'под')
    await user.click(screen.getByTitle('Очистить поиск'))

    expect(screen.getByLabelText('Поиск чатов')).toHaveValue('')
    expect(screen.getByLabelText('Поиск чатов')).toHaveFocus()
    expect(container.querySelectorAll('[data-active]')).toHaveLength(chats.length)
    expect(screen.getByText('2 чата')).toBeInTheDocument()
  })

  it('offers the clear button only while there is something to clear', async () => {
    const user = userEvent.setup()
    renderChatList()

    expect(screen.queryByTitle('Очистить поиск')).not.toBeInTheDocument()

    await typeQuery(user, 'п')

    expect(screen.getByTitle('Очистить поиск')).toBeInTheDocument()
  })

  it('opens the new chat dialog and disconnects on demand', async () => {
    const user = userEvent.setup()
    const { props } = renderChatList()

    await user.click(screen.getByTitle('Новый чат'))
    expect(props.onNewChat).toHaveBeenCalled()

    await user.click(screen.getByTitle('Отключиться'))
    expect(props.onLogout).toHaveBeenCalled()
  })

  it('invites the user to start a chat when the list is empty', async () => {
    const user = userEvent.setup()
    const { props } = renderChatList({ chats: [] })

    expect(screen.getByText('Здесь появятся ваши диалоги')).toBeInTheDocument()
    expect(screen.getByText('Нет активных чатов')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Начать новый чат' }))
    expect(props.onNewChat).toHaveBeenCalled()
  })

  it('shows a row of placeholders and no empty state while the dialogs load', () => {
    const { container } = renderChatList({ chats: [], loading: true })

    const status = screen.getByRole('status', { name: 'Загружаем диалоги' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('status')).toHaveLength(1)

    const rows = status.querySelectorAll('[data-testid="chat-skeleton"]')
    expect(rows).toHaveLength(Math.floor(600 / 68))
    for (const row of rows) expect(row).toHaveAttribute('aria-hidden', 'true')

    expect(screen.queryByText('Здесь появятся ваши диалоги')).not.toBeInTheDocument()
    expect(screen.getByText('Загружаем диалоги…')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-active]')).toHaveLength(0)
  })

  it('replaces the placeholders with the chats as soon as they arrive', () => {
    const { rerender } = renderChatList({ chats: [], loading: true })

    rerender(<ChatList {...createProps()} />)

    expect(screen.queryByRole('status', { name: 'Загружаем диалоги' })).not.toBeInTheDocument()
    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.getByText('2 чата')).toBeInTheDocument()
  })

  it('never puts a placeholder over a chat the store already knows', () => {
    renderChatList({ loading: true })

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Загружаем диалоги' })).not.toBeInTheDocument()
  })

  it('draws a placeholder row for a chat whose profile is still loading', () => {
    const [own, other] = chats
    renderChatList({ chats: [own, { ...other, profileLoading: true }] })

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.queryByText('Поддержка')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('chat-skeleton')).toHaveLength(1)
  })

  it('draws the account as a placeholder while it is being fetched', () => {
    renderChatList({ accountLoading: true, accountTitle: accountName })

    expect(screen.getByTestId('account-skeleton')).toBeInTheDocument()
    expect(screen.queryByText(accountName)).not.toBeInTheDocument()
  })

  it('replaces the chat count with the footer content when it is given', () => {
    renderChatList({ footer: <span>Нет связи с GREEN-API</span> })

    expect(screen.getByText('Нет связи с GREEN-API')).toBeInTheDocument()
    expect(screen.queryByText('2 чата')).not.toBeInTheDocument()
  })

  it('shows the name and the avatar of the authorized account', () => {
    renderChatList({
      accountTitle: accountName,
      accountAvatarUrl: TEST_AVATAR_URL,
    })

    expect(screen.getByText(accountName)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: accountName })).toHaveAttribute('src', TEST_AVATAR_URL)
  })

  it('shows the avatar of a chat and initials when it has none', () => {
    renderChatList({ chats: [{ ...chats[1], avatar: TEST_AVATAR_URL }, chats[0]] })

    expect(screen.getByRole('img', { name: chats[1].title })).toHaveAttribute(
      'src',
      TEST_AVATAR_URL,
    )
    expect(screen.queryByRole('img', { name: chats[0].title })).not.toBeInTheDocument()
  })

  it('renders a window of a long list of chats instead of all of them', () => {
    const many = Array.from({ length: 200 }, (_, index) => ({
      ...chats[0],
      chatId: `chat-${index}`,
      title: `Чат ${index}`,
    }))

    const { container } = renderChatList({ chats: many })

    const items = container.querySelectorAll('[data-active]')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(many.length)
  })
})

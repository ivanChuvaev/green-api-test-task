import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Chat } from '../api/types'
import type { ConnectionStatus } from '../hooks/useMessenger'
import { TEST_AVATAR_URL, contact, contactName, contactPhone } from '../test/fixtures'
import { formatPhone } from '../utils/format'
import { ChatHeader } from './ChatHeader'

const chat: Chat = {
  chatId: contact.chatId,
  title: contactName,
  phone: contactPhone,
  avatar: '',
  unread: 0,
  lastActivity: 0,
  lastMessage: '',
  lastStatus: null,
}

const renderHeader = (connection: ConnectionStatus = 'online', chatOverride = chat) =>
  render(<ChatHeader chat={chatOverride} connection={connection} />)

describe('ChatHeader', () => {
  it('opens the profile when the contact is clicked', () => {
    const onOpenProfile = vi.fn()
    render(<ChatHeader chat={chat} connection="online" onOpenProfile={onOpenProfile} />)

    fireEvent.click(screen.getByRole('button', { name: 'Профиль контакта' }))

    expect(onOpenProfile).toHaveBeenCalled()
  })

  it('shows the name and the formatted number of the chat', () => {
    renderHeader()

    expect(screen.getByText(contactName)).toBeInTheDocument()
    expect(screen.getByText(formatPhone(contactPhone))).toBeInTheDocument()
  })

  it('shows the avatar of the contact', () => {
    renderHeader('online', { ...chat, avatar: TEST_AVATAR_URL })

    expect(screen.getByRole('img', { name: contactName })).toHaveAttribute('src', TEST_AVATAR_URL)
  })

  it('reports the connection only while it is broken, never as the presence of the contact', () => {
    const { rerender } = renderHeader('error')

    expect(screen.getByText('Нет связи с GREEN-API')).toBeInTheDocument()

    rerender(<ChatHeader chat={chat} connection="online" />)

    expect(screen.queryByText('Нет связи с GREEN-API')).not.toBeInTheDocument()
    expect(screen.queryByText('В сети')).not.toBeInTheDocument()
  })

  it('offers a way back to the list only when the callback is given', () => {
    const { rerender } = renderHeader()

    expect(screen.queryByTitle('К списку чатов')).not.toBeInTheDocument()

    rerender(<ChatHeader chat={chat} connection="online" onBack={() => {}} />)

    expect(screen.getByTitle('К списку чатов')).toBeInTheDocument()
  })
})

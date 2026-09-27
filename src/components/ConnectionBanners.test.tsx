import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionStatus } from '../hooks/useMessenger'
import { ConnectionBanners } from './ConnectionBanners'

const renderBanners = (overrides: Partial<React.ComponentProps<typeof ConnectionBanners>> = {}) => {
  const props = {
    connection: 'online' as ConnectionStatus,
    connectionError: null,
    notificationsEnabled: true,
    notificationsBusy: false,
    onEnableNotifications: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ConnectionBanners {...props} />) }
}

describe('ConnectionBanners', () => {
  it('renders nothing when the instance is online and the notifications are on', () => {
    renderBanners()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns about disabled incoming notifications and turns them on', async () => {
    const user = userEvent.setup()
    const { props } = renderBanners({ notificationsEnabled: false })

    expect(screen.getByText(/Входящие уведомления выключены/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Включить' }))

    expect(props.onEnableNotifications).toHaveBeenCalled()
  })

  it('reports a connection error and offers a retry', async () => {
    const user = userEvent.setup()
    const { props } = renderBanners({ connection: 'error', connectionError: 'Нет ответа' })

    expect(screen.getByRole('alert')).toHaveTextContent('Нет ответа')

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(props.onRetry).toHaveBeenCalled()
  })

  it('falls back to a generic message when the error is unknown', () => {
    renderBanners({ connection: 'error' })

    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка соединения')
  })

  it('shows the connecting state until the instance answers', () => {
    renderBanners({ connection: 'connecting', notificationsEnabled: false })

    expect(screen.getByText('Подключение…')).toBeInTheDocument()
  })
})

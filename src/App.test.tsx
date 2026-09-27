import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAccount,
  deleteNotification,
  getAccountSettings,
  getChatHistory,
  getChats,
  getContactInfo,
  getLastIncomingMessages,
  getLastOutgoingMessages,
  getSettings,
  receiveNotification,
  getStateInstance,
} from './api/greenApi'
import { App } from './App'
import { useSession } from './hooks/useSession'
import { account, contact, contactName, credentials } from './test/fixtures'
import { formatPhone } from './utils/format'

vi.mock('./hooks/useSession', () => ({ useSession: vi.fn() }))

vi.mock('./api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/greenApi')>()
  return {
    ...actual,
    getStateInstance: vi.fn(),
    getAccountSettings: vi.fn(),
    getContactInfo: vi.fn(),
    getChats: vi.fn(),
    getChatHistory: vi.fn(),
    getLastIncomingMessages: vi.fn(),
    getLastOutgoingMessages: vi.fn(),
    getSettings: vi.fn(),
    checkAccount: vi.fn(),
    receiveNotification: vi.fn(),
    deleteNotification: vi.fn(),
  }
})

const session = (withCredentials: boolean) => ({
  credentials: withCredentials ? credentials : null,
  restore: () => (withCredentials ? credentials : null),
  save: vi.fn(),
  clear: vi.fn(),
})

beforeEach(() => {
  vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'authorized' })
  vi.mocked(getAccountSettings).mockResolvedValue(account)
  vi.mocked(getContactInfo).mockResolvedValue(contact)
  vi.mocked(getChats).mockResolvedValue([])
  vi.mocked(getChatHistory).mockResolvedValue([])
  vi.mocked(getLastIncomingMessages).mockResolvedValue([])
  vi.mocked(getLastOutgoingMessages).mockResolvedValue([])
  vi.mocked(getSettings).mockResolvedValue({
    webhookUrl: '',
    webhookUrlToken: '',
    incomingWebhook: 'yes',
    outgoingWebhook: 'yes',
    outgoingAPIMessageWebhook: 'yes',
    stateWebhook: 'yes',
    markIncomingMessagesReaded: 'no',
  })
  vi.mocked(receiveNotification).mockImplementation(() => new Promise(() => {}) as Promise<never>)
  vi.mocked(deleteNotification).mockResolvedValue({ result: true })
})

describe('App', () => {
  it('asks for the credentials when the session is empty', () => {
    vi.mocked(useSession).mockReturnValue(session(false))

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Мессенджер' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument()
    expect(getStateInstance).not.toHaveBeenCalled()
  })

  it('opens the chat workspace with stored credentials', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))

    render(<App />)

    expect(screen.getByPlaceholderText('Поиск чатов')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Загружаем диалоги' })).toBeInTheDocument()
    expect(screen.queryByText('Здесь появятся ваши диалоги')).not.toBeInTheDocument()

    expect(await screen.findByText('Здесь появятся ваши диалоги')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Нет активных чатов')).toBeInTheDocument())
  })

  it('warns when the instance has incoming notifications disabled', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))
    vi.mocked(getSettings).mockResolvedValue({
      webhookUrl: '',
      webhookUrlToken: '',
      incomingWebhook: 'no',
      outgoingWebhook: 'no',
      outgoingAPIMessageWebhook: 'no',
      stateWebhook: 'no',
      markIncomingMessagesReaded: 'no',
    })

    render(<App />)

    expect(await screen.findByText(/Входящие уведомления выключены/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Поиск чатов')).toBeInTheDocument()
  })

  it('shows the chat list alone while no chat is selected', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))

    render(<App />)

    expect(await screen.findByText('Здесь появятся ваши диалоги')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Поиск чатов')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Напишите сообщение…' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Отправить (Enter)')).not.toBeInTheDocument()
    expect(screen.queryByText('Контакт')).not.toBeInTheDocument()
  })

  it('returns to the chat list on Escape', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: '100500',
        name: contactName,
        type: 'user',
        phoneNumber: 79991234567,
        username: '',
      },
    ])
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('button', { name: new RegExp(contactName) }))
    expect(screen.getByText('Контакт')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Контакт')).not.toBeInTheDocument()
    expect(screen.getByText('1 чат')).toBeInTheDocument()
  })

  it('closes the new chat dialog on Escape and keeps the chat selected', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: '100500',
        name: contactName,
        type: 'user',
        phoneNumber: 79991234567,
        username: '',
      },
    ])
    const user = userEvent.setup()

    render(<App />)

    await user.click(await screen.findByRole('button', { name: new RegExp(contactName) }))
    await user.click(screen.getByTitle('Новый чат'))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Контакт')).toBeInTheDocument()
  })

  it('finds an account by phone number and opens it without adding a chat', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 79991234567,
      fromCache: true,
    })
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText('Нет активных чатов')).toBeInTheDocument())
    await user.click(screen.getByTitle('Новый чат'))
    await user.type(screen.getByPlaceholderText('Телефон или имя пользователя'), '79991234567')
    await user.click(screen.getByRole('button', { name: 'Поиск' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(checkAccount).toHaveBeenCalledWith(credentials, { phoneNumber: '79991234567' })
    expect(screen.getByLabelText('Напишите сообщение…')).toBeInTheDocument()
    expect(screen.getByText('Контакт')).toBeInTheDocument()
    expect(screen.getAllByText(formatPhone('79991234567'))).toHaveLength(2)
    expect(screen.getByText('Нет активных чатов')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-active]')).toHaveLength(0)
  })

  it('counts the unread messages in the title of the tab', async () => {
    vi.mocked(useSession).mockReturnValue(session(true))
    vi.mocked(receiveNotification)
      .mockResolvedValueOnce({
        receiptId: 1,
        body: {
          typeWebhook: 'incomingMessageReceived',
          instanceData: { idInstance: 1, wid: '1', typeInstance: 'telegram' },
          timestamp: 1_769_000_000,
          idMessage: 'in-1',
          senderData: {
            chatId: contact.chatId,
            chatName: contactName,
            chatType: 'user',
            sender: contact.chatId,
            senderName: contactName,
            senderContactName: '',
            senderPhoneNumber: 0,
          },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'привет' } },
        },
      })
      .mockImplementation(() => new Promise(() => {}))

    render(<App />)

    await waitFor(() => expect(document.title).toBe('(1) Мессенджер'))
  })

  it('disconnects when the user leaves the workspace', async () => {
    const user = userEvent.setup()
    const current = session(true)
    vi.mocked(useSession).mockReturnValue(current)

    render(<App />)
    await user.click(screen.getByTitle('Отключиться'))

    expect(current.clear).toHaveBeenCalled()
  })
})

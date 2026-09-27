import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAccount,
  GreenApiError,
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
  sendMessage,
  setSettings,
} from '../api/greenApi'
import type {
  ChatHistoryMessage,
  ChatListItem,
  InstanceSettings,
  JournalMessage,
  Notification,
} from '../api/types'
import {
  account,
  contact,
  contactName,
  contactPhone,
  contactUsername,
  credentials,
  currentUser,
  TEST_AVATAR_URL,
  TEST_ID_INSTANCE,
} from '../test/fixtures'
import { SELF_CHAT_TITLE, useMessenger } from './useMessenger'

vi.mock('../api/greenApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/greenApi')>()
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
    setSettings: vi.fn(),
    checkAccount: vi.fn(),
    sendMessage: vi.fn(),
    receiveNotification: vi.fn(),
    deleteNotification: vi.fn(),
  }
})

const settings: InstanceSettings = {
  webhookUrl: '',
  webhookUrlToken: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
  stateWebhook: 'yes',
  markIncomingMessagesReaded: 'no',
}

const body = (overrides: Partial<Notification['body']>): Notification['body'] => ({
  typeWebhook: 'incomingMessageReceived',
  instanceData: {
    idInstance: Number(TEST_ID_INSTANCE),
    wid: `${account.phone}@c.us`,
    typeInstance: 'telegram',
  },
  timestamp: Math.floor(Date.now() / 1000),
  idMessage: 'msg-1',
  senderData: {
    chatId: contact.chatId,
    chatName: contactName,
    chatType: 'user',
    sender: contact.chatId,
    senderName: contactName,
    senderContactName: contactName,
    senderPhoneNumber: Number(contactPhone),
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'привет' } },
  ...overrides,
})

const incoming = (idMessage: string, text: string, overrides = {}): Notification => ({
  receiptId: Number(idMessage.replace(/\D/g, '')) || 1,
  body: body({ idMessage, messageData: { textMessageData: { textMessage: text } }, ...overrides }),
})

const outgoing = (idMessage: string, text: string, overrides = {}): Notification => ({
  receiptId: Number(idMessage.replace(/\D/g, '')) || 1,
  body: body({
    typeWebhook: 'outgoingMessageReceived',
    idMessage,
    messageData: { textMessageData: { textMessage: text } },
    ...overrides,
  }),
})

interface PendingPoll {
  resolve: (notification: Notification | null) => void
  reject: (error: Error) => void
}

let pendingPolls: PendingPoll[] = []

const deliver = async (notification: Notification | null) => {
  const poll = pendingPolls.shift()
  if (!poll) throw new Error('The polling loop is not waiting for a notification')
  await act(async () => {
    poll.resolve(notification)
  })
}

const failPoll = async (error: Error) => {
  const poll = pendingPolls.shift()
  if (!poll) throw new Error('The polling loop is not waiting for a notification')
  await act(async () => {
    poll.reject(error)
  })
}

const renderMessenger = () => renderHook(() => useMessenger(credentials))

const waitForOnline = async (result: { current: ReturnType<typeof useMessenger> }) => {
  await waitFor(() => expect(result.current.connection).toBe('online'))
}

beforeEach(() => {
  pendingPolls = []
  vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'authorized' })
  vi.mocked(getAccountSettings).mockResolvedValue(account)
  vi.mocked(getContactInfo).mockResolvedValue(contact)
  vi.mocked(getChats).mockResolvedValue([])
  vi.mocked(getChatHistory).mockResolvedValue([])
  vi.mocked(getLastIncomingMessages).mockResolvedValue([])
  vi.mocked(getLastOutgoingMessages).mockResolvedValue([])
  vi.mocked(getSettings).mockResolvedValue(settings)
  vi.mocked(receiveNotification).mockImplementation(
    () =>
      new Promise<Notification | null>((resolve, reject) => {
        pendingPolls.push({ resolve, reject })
      }),
  )
  vi.mocked(deleteNotification).mockResolvedValue({ result: true })
  vi.mocked(sendMessage).mockResolvedValue({ idMessage: 'server-1' })
})

describe('useMessenger', () => {
  it('reads the instance data and reports the online state', async () => {
    const { result } = renderMessenger()

    await waitForOnline(result)
    expect(result.current.currentUser).toEqual(currentUser)
    expect(result.current.notificationsEnabled).toBe(true)
  })

  it('asks the chat list for attention only while the instance needs it', async () => {
    const { result } = renderMessenger()

    expect(result.current.needsAttention).toBe(true)

    await waitForOnline(result)

    expect(result.current.needsAttention).toBe(false)
  })

  it('keeps asking for attention while the incoming notifications are off', async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...settings, incomingWebhook: 'no' })
    const { result } = renderMessenger()

    await waitForOnline(result)

    expect(result.current.needsAttention).toBe(true)
  })

  it('names the account by a message of the chat with itself', async () => {
    vi.mocked(getLastIncomingMessages).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'self-1',
        timestamp: 1_769_000_100,
        typeMessage: 'textMessage',
        chatId: account.chatId,
        chatType: 'user',
        textMessage: 'заметка самому себе',
        senderId: account.chatId,
        senderName: contactName,
      },
    ] satisfies JournalMessage[])
    const { result } = renderMessenger()

    await waitForOnline(result)

    await waitFor(() => expect(result.current.currentUser?.name).toBe(contactName))
    expect(result.current.currentUser).toEqual({ ...currentUser, name: contactName })
  })

  it('ignores a name that belongs to somebody else', async () => {
    vi.mocked(getLastIncomingMessages).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'peer-1',
        timestamp: 1_769_000_100,
        typeMessage: 'textMessage',
        chatId: '100500',
        chatType: 'user',
        textMessage: 'привет',
        senderId: '100500',
        senderName: contactName,
      },
    ] satisfies JournalMessage[])
    const { result } = renderMessenger()

    await waitForOnline(result)
    await waitFor(() => expect(result.current.chats).toHaveLength(1))

    expect(result.current.currentUser).toEqual(currentUser)
  })

  it('names the account by an outgoing notification', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await deliver(
      outgoing('out-1', 'Отправлено с телефона', {
        chatId: '100500',
        senderData: {
          chatId: '100500',
          chatName: 'Поддержка',
          chatType: 'user',
          sender: account.chatId,
          senderName: contactName,
          senderContactName: '',
          senderPhoneNumber: 79991234567,
        },
      }),
    )

    await waitFor(() => expect(result.current.currentUser?.name).toBe(contactName))
  })

  it('keeps the name the instance reported first', async () => {
    vi.mocked(getLastIncomingMessages).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'self-1',
        timestamp: 1_769_000_100,
        typeMessage: 'textMessage',
        chatId: account.chatId,
        chatType: 'user',
        textMessage: 'заметка самому себе',
        senderId: account.chatId,
        senderName: contactName,
      },
    ] satisfies JournalMessage[])
    const { result } = renderMessenger()
    await waitForOnline(result)
    await waitFor(() => expect(result.current.currentUser?.name).toBe(contactName))

    await deliver(
      outgoing('out-2', 'Ещё одно', {
        chatId: '100500',
        senderData: {
          chatId: '100500',
          chatName: 'Поддержка',
          chatType: 'user',
          sender: account.chatId,
          senderName: 'Другое имя',
          senderContactName: '',
          senderPhoneNumber: 79991234567,
        },
      }),
    )

    expect(result.current.currentUser?.name).toBe(contactName)
  })

  it('keeps the known name when the account is read again', async () => {
    vi.mocked(getLastIncomingMessages).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'self-1',
        timestamp: 1_769_000_100,
        typeMessage: 'textMessage',
        chatId: account.chatId,
        chatType: 'user',
        textMessage: 'заметка самому себе',
        senderId: account.chatId,
        senderName: contactName,
      },
    ] satisfies JournalMessage[])
    const { result } = renderMessenger()
    await waitForOnline(result)
    await waitFor(() => expect(result.current.currentUser?.name).toBe(contactName))

    await act(async () => {
      await result.current.refreshAccount()
    })

    await waitFor(() => expect(result.current.currentUser?.name).toBe(contactName))
  })

  it('leaves the account without a name when nothing names it', async () => {
    const { result } = renderMessenger()

    await waitForOnline(result)
    await waitFor(() => expect(result.current.chats).toHaveLength(0))

    expect(result.current.currentUser).toEqual(currentUser)
  })

  it('keeps the connection online when the dialogs fail', async () => {
    vi.mocked(getChats).mockRejectedValue(new Error('Failed to fetch'))
    const { result } = renderMessenger()

    await waitForOnline(result)
    await waitFor(() => expect(result.current.dialogsLoading).toBe(false))

    expect(result.current.connection).toBe('online')
    expect(result.current.currentUser).toEqual(currentUser)
  })

  it('reports an instance that is not authorized', async () => {
    vi.mocked(getStateInstance).mockResolvedValue({ stateInstance: 'notAuthorized' })
    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.connection).toBe('unauthorized'))
    expect(result.current.connectionError).toContain('не авторизован')
  })

  it('reports a failed instance request with a fallback message', async () => {
    vi.mocked(getStateInstance).mockRejectedValue(new Error('Failed to fetch'))
    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.connection).toBe('error'))
    expect(result.current.connectionError).toBe('Не удалось получить данные инстанса')
  })

  it('surfaces a GREEN-API error message', async () => {
    vi.mocked(getStateInstance).mockRejectedValue(new GreenApiError('Превышен лимит запросов', 429))
    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.connection).toBe('error'))
    expect(result.current.connectionError).toBe('Превышен лимит запросов')
  })

  it('shows a warning when incoming notifications are disabled', async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...settings, incomingWebhook: 'no' })
    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.settings).not.toBeNull())
    expect(result.current.notificationsEnabled).toBe(false)
  })

  it('enables incoming notifications and re-reads the settings', async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ ...settings, incomingWebhook: 'no' })
    vi.mocked(setSettings).mockResolvedValue({ saveSettings: true })
    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.notificationsEnabled).toBe(false))

    await act(async () => {
      await result.current.enableNotifications()
    })

    expect(setSettings).toHaveBeenCalledWith(
      credentials,
      expect.objectContaining({ incomingWebhook: 'yes', webhookUrl: '' }),
    )
    expect(result.current.notificationsEnabled).toBe(true)
  })

  it('starts polling for notifications', async () => {
    renderMessenger()

    await waitFor(() => expect(receiveNotification).toHaveBeenCalled())
    expect(receiveNotification).toHaveBeenCalledWith(
      credentials,
      expect.any(Number),
      expect.any(AbortSignal),
    )
  })

  it('renders an incoming message and acknowledges the notification', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await deliver(incoming('msg-1', 'привет'))

    expect(result.current.chats).toHaveLength(1)
    expect(result.current.chats[0]).toMatchObject({
      chatId: contact.chatId,
      title: contactName,
      phone: contactPhone,
      lastMessage: 'привет',
    })
    expect(deleteNotification).toHaveBeenCalledWith(credentials, 1)
  })

  it('keeps the received message in the selected chat', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await deliver(incoming('msg-1', 'первое'))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({ text: 'первое', direction: 'in' })
    expect(result.current.activeChat?.unread).toBe(0)
  })

  it('counts unread messages of the chat that is not open', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await deliver(incoming('msg-1', 'пока меня не видно'))
    expect(result.current.chats[0]?.unread).toBe(1)

    act(() => {
      result.current.selectChat(contact.chatId)
    })

    expect(result.current.chats[0]?.unread).toBe(0)
  })

  it('counts the messages of the open chat while the tab is in the background', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await deliver(incoming('msg-1', 'пока вкладка скрыта'))
    expect(result.current.activeChat?.unread).toBe(1)

    hidden.mockReturnValue(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.activeChat?.unread).toBe(0)
  })

  it('reports the chat list as loading until the dialogs have been requested', async () => {
    const { result } = renderMessenger()

    expect(result.current.dialogsLoading).toBe(true)

    await waitFor(() => expect(result.current.dialogsLoading).toBe(false))
  })

  it('reports the chat list as loaded when the dialogs cannot be requested', async () => {
    vi.mocked(getChats).mockRejectedValue(new GreenApiError('HTTP 500', 500))

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.dialogsLoading).toBe(false))
    expect(result.current.chats).toHaveLength(0)
  })

  it('stops reporting the chat list as loading before the journals arrive', async () => {
    let releaseJournals = () => {}
    vi.mocked(getLastIncomingMessages).mockReturnValue(
      new Promise((resolve) => {
        releaseJournals = () => resolve([])
      }),
    )

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.dialogsLoading).toBe(false))
    expect(result.current.chats).toHaveLength(0)
    releaseJournals()
  })

  it('fills the chat list from the instance on start', async () => {
    const items: ChatListItem[] = [
      {
        chatId: contact.chatId,
        name: contactName,
        type: 'user',
        phoneNumber: Number(contactPhone),
        username: contactUsername,
      },
      {
        chatId: '-100500',
        name: 'Рабочий чат',
        type: 'supergroup',
        phoneNumber: 0,
        username: '',
      },
    ]
    vi.mocked(getChats).mockResolvedValue(items)

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.chats).toHaveLength(2))
    expect(result.current.chats[0]).toMatchObject({ chatId: '-100500', title: 'Рабочий чат' })
    expect(result.current.chats[1]).toMatchObject({
      chatId: contact.chatId,
      title: contactName,
      phone: contactPhone,
    })
  })

  it('loads the avatar of a named dialog without renaming it', async () => {
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: '100500',
        name: 'Имя из телефонной книги',
        type: 'user',
        phoneNumber: 79991234567,
        username: '',
      },
    ])

    const { result } = renderMessenger()

    await waitFor(() =>
      expect(result.current.chats.find((chat) => chat.chatId === '100500')?.avatar).toBe(
        TEST_AVATAR_URL,
      ),
    )
    expect(getContactInfo).toHaveBeenCalledWith(credentials, '100500', expect.anything())
    expect(result.current.chats.find((chat) => chat.chatId === '100500')?.title).toBe(
      'Имя из телефонной книги',
    )
  })

  it('fills the preview of every chat from the message journals', async () => {
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: contact.chatId,
        name: contactName,
        type: 'user',
        phoneNumber: Number(contactPhone),
        username: '',
      },
    ])
    vi.mocked(getLastIncomingMessages).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'in-1',
        timestamp: 1_769_000_100,
        typeMessage: 'textMessage',
        chatId: contact.chatId,
        chatType: 'user',
        textMessage: 'привет',
        senderName: contactName,
      },
    ] satisfies JournalMessage[])
    vi.mocked(getLastOutgoingMessages).mockResolvedValue([
      {
        type: 'outgoing',
        idMessage: 'out-1',
        timestamp: 1_769_000_200,
        typeMessage: 'textMessage',
        chatId: contact.chatId,
        chatType: 'user',
        textMessage: 'добрый день',
        statusMessage: 'read',
      },
    ] satisfies JournalMessage[])

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.chats[0]?.lastMessage).toBe('добрый день'))
    expect(result.current.chats[0]).toMatchObject({
      title: contactName,
      lastActivity: 1_769_000_200_000,
      unread: 0,
    })
  })

  it('loads the history of a chat when it is opened', async () => {
    const history: ChatHistoryMessage[] = [
      {
        type: 'incoming',
        idMessage: 'msg-2',
        timestamp: 1_769_000_000,
        typeMessage: 'textMessage',
        chatId: '200500',
        chatType: 'user',
        textMessage: 'второе',
      },
      {
        type: 'outgoing',
        idMessage: 'msg-1',
        timestamp: 1_768_999_000,
        typeMessage: 'textMessage',
        chatId: '200500',
        chatType: 'user',
        textMessage: 'первое',
        statusMessage: 'read',
      },
    ]
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: '200500',
        name: contactName,
        type: 'user',
        phoneNumber: Number(contactPhone),
        username: '',
      },
    ])
    vi.mocked(getChatHistory).mockResolvedValue(history)

    const { result } = renderMessenger()
    await waitFor(() => expect(result.current.chats).toHaveLength(1))

    act(() => {
      result.current.selectChat('200500')
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.messages.map((message) => message.text)).toEqual(['первое', 'второе'])
    expect(result.current.messages[1]).toMatchObject({ direction: 'in', status: 'read' })
    expect(result.current.chats[0]).toMatchObject({ lastMessage: 'второе' })
  })

  it('treats the messages of the chat with the own account as outgoing', async () => {
    vi.mocked(getChatHistory).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'self-1',
        timestamp: 1_769_000_000,
        typeMessage: 'textMessage',
        chatId: account.chatId,
        chatType: 'user',
        textMessage: 'заметка самому себе',
      },
    ])

    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(account.chatId)
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    expect(result.current.messages[0]).toMatchObject({ direction: 'out', status: 'sent' })
  })

  it('does not duplicate a message the notification queue already delivered', async () => {
    vi.mocked(getChats).mockResolvedValue([
      {
        chatId: contact.chatId,
        name: contactName,
        type: 'user',
        phoneNumber: Number(contactPhone),
        username: '',
      },
    ])
    vi.mocked(getChatHistory).mockResolvedValue([
      {
        type: 'incoming',
        idMessage: 'msg-1',
        timestamp: 1_769_000_000,
        typeMessage: 'textMessage',
        chatId: contact.chatId,
        chatType: 'user',
        textMessage: 'привет',
      },
    ])

    const { result } = renderMessenger()
    await waitFor(() => expect(result.current.chats).toHaveLength(1))

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    await deliver(incoming('msg-1', 'привет'))

    expect(result.current.messages).toHaveLength(1)
  })

  it('ignores a duplicated notification', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await deliver(incoming('msg-1', 'один раз'))
    await deliver(incoming('msg-1', 'один раз'))

    expect(result.current.messages).toHaveLength(1)
  })

  it('acknowledges and skips a notification that is not a message', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await deliver({
      receiptId: 1,
      body: body({ idMessage: 'reaction-1', messageData: { typeMessage: 'reactionMessage' } }),
    })

    expect(result.current.chats).toHaveLength(0)
    expect(deleteNotification).toHaveBeenCalledWith(credentials, 1)
  })

  it('keeps polling after an empty long-poll response', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await deliver(null)

    await waitFor(() => expect(pendingPolls.length).toBeGreaterThan(0))
    expect(result.current.connection).toBe('online')
  })

  it('keeps the connection online when the long poll ends with a timeout', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await failPoll(new GreenApiError('HTTP 408', 408))

    await waitFor(() => expect(pendingPolls.length).toBeGreaterThan(0))
    expect(result.current.connection).toBe('online')
    expect(result.current.connectionError).toBeNull()

    await deliver(incoming('msg-1', 'привет'))
    expect(result.current.chats[0]?.lastMessage).toBe('привет')
  })

  it('keeps the connection online while the API is unavailable', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await failPoll(new GreenApiError('HTTP 502', 502))

    await waitFor(() => expect(getChats).toHaveBeenCalled())
    expect(result.current.connection).toBe('online')
  })

  it('reports a rejected request as a connection error', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await failPoll(new GreenApiError('HTTP 401', 401))

    await waitFor(() => expect(result.current.connection).toBe('error'))
    expect(result.current.connectionError).toContain('401')
  })

  it('reports the connection back with the next round, an empty one included', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await failPoll(new GreenApiError('Нет связи с GREEN-API', 0))
    await waitFor(() => expect(result.current.connection).toBe('error'))

    await waitFor(() => expect(pendingPolls).toHaveLength(1), { timeout: 3000 })
    await failPoll(new GreenApiError('', 408))

    await waitFor(() => expect(result.current.connection).toBe('online'))
    expect(result.current.connectionError).toBeNull()
  })

  it('stops asking for profiles once the quota of the method is used up', async () => {
    vi.mocked(getChats).mockResolvedValue([
      { chatId: '1', name: '', type: 'user', phoneNumber: 0, username: '' },
      { chatId: '2', name: '', type: 'user', phoneNumber: 0, username: '' },
      { chatId: '3', name: '', type: 'user', phoneNumber: 0, username: '' },
    ])
    vi.mocked(getContactInfo).mockRejectedValue(new GreenApiError('QUOTE_EXCEEDED', 466))

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.chats).toHaveLength(3))
    await waitFor(() =>
      expect(result.current.chats.some((chat) => chat.profileLoading)).toBe(false),
    )
    const options = vi.mocked(getContactInfo).mock.calls.map(([, , options]) => options)
    expect(options.every((option) => option?.priority === 'background')).toBe(true)
    expect(options.every((option) => option?.signal?.aborted)).toBe(true)
  })

  it('names the chat of the account with itself like the messengers do', async () => {
    vi.mocked(getChats).mockResolvedValue([
      { chatId: account.chatId, name: '', type: 'user', phoneNumber: 0, username: '@me' },
    ])

    const { result } = renderMessenger()

    await waitFor(() => expect(result.current.chats[0]?.title).toBe(SELF_CHAT_TITLE))
  })

  it('sends a message optimistically and swaps the local id for the server one', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await act(async () => {
      await result.current.send(contact.chatId, '  отправляю  ')
    })

    expect(sendMessage).toHaveBeenCalledWith(credentials, contact.chatId, 'отправляю')
    expect(result.current.messages[0]).toMatchObject({
      id: 'server-1',
      text: 'отправляю',
      direction: 'out',
      status: 'sent',
    })
  })

  it('stamps a sent message in whole seconds, like the API does', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_769_000_500_700)
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await act(async () => {
      await result.current.send(contact.chatId, 'привет')
    })

    expect(result.current.messages[0].timestamp).toBe(1_769_000_500_000)
    now.mockRestore()
  })

  it('does not send an empty message', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await act(async () => {
      await result.current.send(contact.chatId, '   ')
    })

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('marks the message as failed when the API call fails', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error('rate limit'))
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await act(async () => {
      await expect(result.current.send(contact.chatId, 'привет')).rejects.toThrow('rate limit')
    })

    expect(result.current.messages[0].status).toBe('failed')
  })

  it('updates the status of an outgoing message from the notification queue', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    act(() => {
      result.current.selectChat(contact.chatId)
    })
    await act(async () => {
      await result.current.send(contact.chatId, 'привет')
    })
    await deliver({
      receiptId: 11,
      body: body({
        typeWebhook: 'outgoingMessageStatus',
        idMessage: 'server-1',
        chatId: contact.chatId,
        status: 'read',
      }),
    })

    expect(result.current.messages[0].status).toBe('read')
  })

  it('finds an account by phone number and opens it without adding a chat', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 79991234567,
      fromCache: true,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      const contact = await result.current.findChat('+7 (999) 123-45-67')
      expect(contact.chatId).toBe('100500')
    })

    expect(checkAccount).toHaveBeenCalledWith(credentials, { phoneNumber: '79991234567' })
    expect(result.current.activeChatId).toBe('100500')
    expect(result.current.activeChat).toMatchObject({
      title: contactName,
      phone: '79991234567',
      avatar: TEST_AVATAR_URL,
    })
    expect(result.current.chats).toHaveLength(0)
  })

  it('finds an account by username and opens it without adding a chat', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 0,
      fromCache: false,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      const contact = await result.current.findChat('@support')
      expect(contact.chatId).toBe('100500')
    })

    expect(checkAccount).toHaveBeenCalledWith(credentials, { username: '@support' })
    expect(result.current.activeChatId).toBe('100500')
    expect(result.current.activeChat).toMatchObject({ title: contactName, phone: '' })
    expect(result.current.chats).toHaveLength(0)
  })

  it('adds the chat to the list with the first message sent to the found account', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 79991234567,
      fromCache: true,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      await result.current.findChat('+7 (999) 123-45-67')
    })
    await act(async () => {
      await result.current.send('100500', 'первое сообщение')
    })

    expect(result.current.chats).toHaveLength(1)
    expect(result.current.chats[0]).toMatchObject({
      chatId: '100500',
      title: contactName,
      lastMessage: 'первое сообщение',
    })
    expect(result.current.messages[0]).toMatchObject({ text: 'первое сообщение' })
    expect(result.current.activeChat?.chatId).toBe('100500')
  })

  it('adds the chat to the list when the found account writes first', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 79991234567,
      fromCache: true,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      await result.current.findChat('+7 (999) 123-45-67')
    })
    await deliver(
      incoming('server-2', 'привет', {
        chatId: '100500',
        senderData: {
          chatId: '100500',
          chatName: contactName,
          chatType: 'user',
          sender: '100500',
          senderName: 'Контакт',
          senderContactName: contactName,
          senderPhoneNumber: 79991234567,
        },
      }),
    )

    expect(result.current.chats).toHaveLength(1)
    expect(result.current.chats[0]).toMatchObject({
      chatId: '100500',
      title: contactName,
      lastMessage: 'привет',
    })
  })

  it('forgets a found account that was never written to', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: true,
      chatId: '100500',
      username: '@support',
      phoneNumber: 79991234567,
      fromCache: true,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      await result.current.findChat('+7 (999) 123-45-67')
    })
    expect(result.current.activeChat?.chatId).toBe('100500')

    act(() => {
      result.current.selectChat('')
    })

    expect(result.current.activeChat).toBeNull()
    expect(result.current.chats).toHaveLength(0)
  })

  it('rejects a phone number without an account in the messenger', async () => {
    vi.mocked(checkAccount).mockResolvedValue({
      exist: false,
      chatId: '',
      username: '',
      phoneNumber: 79991234567,
      fromCache: true,
    })

    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      await expect(result.current.findChat('79991234567')).rejects.toThrow(/не найден/)
    })
    expect(result.current.activeChatId).toBeNull()
  })

  it('rejects a malformed phone number or username without calling the API', async () => {
    const { result } = renderMessenger()
    await waitForOnline(result)

    await act(async () => {
      await expect(result.current.findChat('123')).rejects.toThrow(/\+7 \(000\) 000-00-00/)
    })
    await act(async () => {
      await expect(result.current.findChat('@abc')).rejects.toThrow(/@username/)
    })
    expect(checkAccount).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import type {
  ChatHistoryMessage,
  ChatListItem,
  JournalMessage,
  NotificationBody,
} from '../api/types'
import { contactName, contactUsername } from '../test/fixtures'
import {
  appendMessage,
  applyNotification,
  createStore,
  mergeChats,
  mergeHistory,
  mergeJournal,
  resolveProfile,
  type StoreState,
} from './messengerStore'

const chatItem = (overrides: Partial<ChatListItem> = {}): ChatListItem => ({
  chatId: '100500',
  name: contactName,
  type: 'user',
  phoneNumber: 79991234567,
  username: contactUsername,
  ...overrides,
})

const message = (overrides: Partial<ChatHistoryMessage> = {}): ChatHistoryMessage => ({
  type: 'incoming',
  idMessage: 'msg-1',
  timestamp: 1_769_000_000,
  typeMessage: 'textMessage',
  chatId: '100500',
  chatType: 'user',
  textMessage: 'привет',
  senderId: '100500',
  ...overrides,
})

const journal = (overrides: Partial<JournalMessage> = {}): JournalMessage => message(overrides)

const messageNotification = (overrides: Partial<NotificationBody> = {}): NotificationBody => ({
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 1, wid: '1', typeInstance: 'telegram' },
  timestamp: 1_769_000_000,
  idMessage: 'msg-1',
  senderData: {
    chatId: '100500',
    chatName: contactName,
    chatType: 'user',
    sender: '100500',
    senderName: contactName,
    senderContactName: '',
    senderPhoneNumber: 79991234567,
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'привет' } },
  ...overrides,
})

const ownSender = {
  chatId: '100500',
  chatName: '',
  chatType: 'user',
  sender: '70001234567',
  senderName: 'Я сам',
  senderContactName: '',
  senderPhoneNumber: 79001234567,
}

const statusNotification = (idMessage: string, status: string): NotificationBody => ({
  typeWebhook: 'outgoingMessageStatus',
  instanceData: { idInstance: 1, wid: '1', typeInstance: 'whatsapp' },
  timestamp: 1_769_000_600,
  idMessage,
  status,
})

const withChats = (...chatIds: string[]): StoreState => ({
  ...createStore(),
  chats: chatIds.map((chatId) => ({
    chatId,
    title: chatId,
    phone: '',
    avatar: '',
    unread: 0,
    lastActivity: 0,
    lastMessage: '',
    lastStatus: null,
  })),
})

const chatOf = (state: StoreState, chatId: string) =>
  state.chats.find((chat) => chat.chatId === chatId)

describe('applyNotification', () => {
  it('names the chat and takes the number of the contact who wrote', () => {
    const state = applyNotification(createStore(), messageNotification(), null)

    expect(chatOf(state, '100500')).toMatchObject({ title: contactName, phone: '79991234567' })
  })

  it('never gives the chat the name or the number of the account that sent a message', () => {
    const named = mergeChats(createStore(), [chatItem()])
    const state = applyNotification(
      named,
      messageNotification({ typeWebhook: 'outgoingAPIMessageReceived', senderData: ownSender }),
      '100500',
    )

    expect(chatOf(state, '100500')).toMatchObject({ title: contactName, phone: '79991234567' })
    expect(state.messages['100500']?.[0]).toMatchObject({ direction: 'out' })
  })

  it('names a group by the group, not by the member who wrote', () => {
    const state = applyNotification(
      createStore(),
      messageNotification({
        senderData: { ...ownSender, chatId: '-100', chatName: 'Рабочий чат', sender: '200' },
      }),
      null,
    )

    expect(chatOf(state, '-100')).toMatchObject({ title: 'Рабочий чат', phone: '' })
  })

  it('reads the text of a link or a reply', () => {
    const state = applyNotification(
      createStore(),
      messageNotification({
        messageData: {
          typeMessage: 'extendedTextMessage',
          extendedTextMessageData: { text: 'https://green-api.com' },
        },
      }),
      null,
    )

    expect(chatOf(state, '100500')?.lastMessage).toBe('https://green-api.com')
  })

  it('stands a label in for a media message and skips what is not a message', () => {
    const sticker = applyNotification(
      createStore(),
      messageNotification({ messageData: { typeMessage: 'stickerMessage' } }),
      null,
    )
    const reaction = applyNotification(
      createStore(),
      messageNotification({ messageData: { typeMessage: 'reactionMessage' } }),
      null,
    )

    expect(sticker.messages['100500']?.[0]).toMatchObject({ text: '', attachment: 'Стикер' })
    expect(chatOf(sticker, '100500')?.lastMessage).toBe('Стикер')
    expect(reaction.chats).toHaveLength(0)
  })
})

describe('mergeChats', () => {
  it('shows the first and the last name of the user in the chat list', () => {
    const state = mergeChats(createStore(), [chatItem()])

    expect(chatOf(state, '100500')?.title).toBe(contactName)
  })

  it('replaces a @username placeholder with the name from the API', () => {
    const withPlaceholder = mergeChats(createStore(), [chatItem({ name: '' })])
    expect(chatOf(withPlaceholder, '100500')?.title).toBe(contactUsername)

    const state = mergeChats(withPlaceholder, [chatItem()])

    expect(chatOf(state, '100500')?.title).toBe(contactName)
  })

  it('keeps the phone number of a chat whose API entry hides it', () => {
    const first = mergeChats(createStore(), [chatItem()])
    const state = mergeChats(first, [chatItem({ phoneNumber: 0 })])

    expect(chatOf(state, '100500')?.phone).toBe('79991234567')
  })

  it('leaves a group without a phone number', () => {
    const state = mergeChats(createStore(), [
      chatItem({ chatId: '-100500', name: 'Рабочий чат', type: 'supergroup', phoneNumber: 0 }),
    ])

    expect(chatOf(state, '-100500')?.phone).toBe('')
  })

  it('puts the newest dialog of the API response on top', () => {
    const state = mergeChats(createStore(), [
      chatItem({ chatId: '1', name: 'Старый диалог' }),
      chatItem({ chatId: '2', name: 'Новый диалог' }),
    ])

    expect(state.chats.map((chat) => chat.chatId)).toEqual(['2', '1'])
  })

  it('does not drop the messages and the counters of a known chat', () => {
    const first = mergeChats(createStore(), [chatItem()])
    const withMessage = mergeJournal(first, [journal()])
    const state = mergeChats(withMessage, [chatItem()])

    expect(state.messages['100500']).toHaveLength(1)
    expect(chatOf(state, '100500')?.lastMessage).toBe('привет')
  })
})

describe('mergeJournal', () => {
  it('shows the newest message of a chat as its preview', () => {
    const state = mergeJournal(withChats('100500', '200500'), [
      journal({ idMessage: 'in-1', textMessage: 'старое' }),
      journal({ idMessage: 'in-2', timestamp: 1_769_000_100, textMessage: 'новое' }),
      journal({ chatId: '200500', idMessage: 'out-1', type: 'outgoing', textMessage: 'ответ' }),
    ])

    expect(chatOf(state, '100500')?.lastMessage).toBe('новое')
    expect(chatOf(state, '100500')?.lastActivity).toBe(1_769_000_100_000)
    expect(chatOf(state, '200500')?.lastMessage).toBe('ответ')
  })

  it('keeps the last message of the chat, whatever the order of the journals', () => {
    const state = mergeJournal(withChats('100500'), [
      journal({ idMessage: 'newest', timestamp: 1_769_000_500, textMessage: 'новое' }),
      journal({
        idMessage: 'oldest',
        timestamp: 1_769_000_100,
        type: 'outgoing',
        textMessage: 'старое',
      }),
    ])

    expect(chatOf(state, '100500')?.lastMessage).toBe('новое')
  })

  it('does not count a journal entry as unread', () => {
    const state = mergeJournal(withChats('100500'), [journal()])

    expect(chatOf(state, '100500')?.unread).toBe(0)
  })

  it('moves the chat with the newest message to the top of the list', () => {
    const state = mergeJournal(withChats('100500', '200500'), [
      journal({ chatId: '100500', idMessage: 'a', timestamp: 1_769_000_100 }),
      journal({ chatId: '200500', idMessage: 'b', timestamp: 1_769_000_200 }),
    ])

    expect(state.chats.map((chat) => chat.chatId)).toEqual(['200500', '100500'])
  })

  it('skips a message the store already knows', () => {
    const first = mergeJournal(withChats('100500'), [journal()])
    const state = mergeJournal(first, [journal()])

    expect(state.messages['100500']).toHaveLength(1)
  })

  it('uses the caption of a media message as the preview', () => {
    const state = mergeJournal(withChats('100500'), [
      journal({ idMessage: 'media-1', textMessage: '', caption: 'схема' }),
    ])

    expect(chatOf(state, '100500')?.lastMessage).toBe('схема')
  })

  it('names a chat by a media message and shows the caption after its kind', () => {
    const state = mergeJournal(createStore(), [
      journal({
        typeMessage: 'imageMessage',
        textMessage: undefined,
        caption: 'отпуск',
        senderName: contactName,
      }),
    ])

    expect(chatOf(state, '100500')).toMatchObject({
      title: contactName,
      lastMessage: 'Фото: отпуск',
    })
  })

  it('does not name a group by the member who wrote to it', () => {
    const state = mergeJournal(mergeChats(createStore(), [chatItem({ name: 'Рабочий чат' })]), [
      journal({ senderId: '200', senderName: 'Участник' }),
    ])

    expect(chatOf(state, '100500')?.title).toBe('Рабочий чат')
  })

  it('ignores an entry without any text', () => {
    const state = mergeJournal(withChats('100500'), [journal({ textMessage: '' })])

    expect(state.messages['100500']).toBeUndefined()
    expect(chatOf(state, '100500')?.lastMessage).toBe('')
  })

  it('keeps the messages of a chat sorted when a journal delivers an older one last', () => {
    const first = mergeJournal(withChats('100500'), [
      journal({ idMessage: 'newest', timestamp: 1_769_000_500, textMessage: 'новое' }),
    ])
    const state = mergeJournal(first, [
      journal({ idMessage: 'oldest', timestamp: 1_769_000_100, textMessage: 'старое' }),
    ])

    expect(state.messages['100500'].map((item) => item.text)).toEqual(['старое', 'новое'])
  })

  it('keeps the list sorted when a journal reaches further back than a page of history', () => {
    const page = [1_769_000_400, 1_769_000_500].map((timestamp, index) =>
      message({ idMessage: `page-${index}`, timestamp }),
    )
    const loaded = mergeHistory(withChats('100500'), '100500', page)
    const state = mergeJournal(loaded, [
      journal({ idMessage: 'older', timestamp: 1_769_000_100 }),
      journal({ idMessage: 'fresh', timestamp: 1_769_000_600 }),
    ])

    expect(state.messages['100500'].map((item) => item.id)).toEqual([
      'older',
      'page-0',
      'page-1',
      'fresh',
    ])
  })

  it('keeps the newest message as the preview when an older one arrives', () => {
    const first = mergeJournal(withChats('100500', '200500'), [
      journal({ idMessage: 'newest', timestamp: 1_769_000_500, textMessage: 'новое' }),
    ])
    const state = mergeJournal(first, [
      journal({ idMessage: 'oldest', timestamp: 1_769_000_100, textMessage: 'старое' }),
    ])

    expect(chatOf(state, '100500')?.lastMessage).toBe('новое')
    expect(state.chats.map((chat) => chat.chatId)).toEqual(['100500', '200500'])
  })

  it('keeps two messages of the same second in the order they arrived', () => {
    const first = mergeJournal(withChats('100500'), [
      journal({ idMessage: 'a', timestamp: 1_769_000_500, textMessage: 'первое' }),
    ])
    const state = mergeJournal(first, [
      journal({ idMessage: 'b', timestamp: 1_769_000_500, textMessage: 'второе' }),
    ])

    expect(state.messages['100500'].map((item) => item.text)).toEqual(['первое', 'второе'])
  })
})

describe('messages of the same second', () => {
  it('puts a message before the reply of the same second, whatever order the journals come in', () => {
    const state = mergeJournal(withChats('100500'), [
      journal({ idMessage: 'reply', timestamp: 1_769_000_500, textMessage: 'ответ' }),
      journal({
        type: 'outgoing',
        idMessage: 'ask',
        timestamp: 1_769_000_500,
        textMessage: '/start',
      }),
    ])

    expect(state.messages['100500'].map((item) => item.id)).toEqual(['ask', 'reply'])
  })

  it('puts a reply of the same second after the message that is still being sent', () => {
    const withOptimistic = appendMessage(
      withChats('100500'),
      {
        id: 'local-1',
        chatId: '100500',
        text: '/start',
        direction: 'out',
        timestamp: 1_769_000_500_000,
        status: 'pending',
      },
      0,
    )
    const state = applyNotification(
      withOptimistic,
      {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 1, wid: '1', typeInstance: 'whatsapp' },
        timestamp: 1_769_000_500,
        idMessage: 'reply',
        senderData: {
          chatId: '100500',
          chatName: contactName,
          chatType: 'user',
          sender: '100500',
          senderName: contactName,
          senderContactName: contactName,
          senderPhoneNumber: 79991234567,
        },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'ответ' },
        },
      },
      '100500',
    )

    expect(state.messages['100500'].map((item) => item.id)).toEqual(['local-1', 'reply'])
  })
})

describe('mergeHistory', () => {
  it('sorts the history of an opened chat chronologically', () => {
    const state = mergeHistory(withChats('100500'), '100500', [
      message({ idMessage: 'msg-2', timestamp: 1_769_000_200, textMessage: 'второе' }),
      message({ idMessage: 'msg-1', timestamp: 1_769_000_100, textMessage: 'первое' }),
    ])

    expect(state.messages['100500'].map((item) => item.text)).toEqual(['первое', 'второе'])
    expect(chatOf(state, '100500')?.lastMessage).toBe('второе')
  })

  it('keeps the messages of one second in the order of the conversation', () => {
    const state = mergeHistory(withChats('100500'), '100500', [
      message({ idMessage: 'msg-2', timestamp: 1_769_000_100, textMessage: 'второе' }),
      message({ idMessage: 'msg-1', timestamp: 1_769_000_100, textMessage: 'первое' }),
    ])

    expect(state.messages['100500'].map((item) => item.text)).toEqual(['первое', 'второе'])
  })

  it('puts the sent message before the reply of the same second', () => {
    const state = mergeHistory(withChats('100500'), '100500', [
      message({ idMessage: 'reply', timestamp: 1_769_000_100, textMessage: 'ответ' }),
      message({
        type: 'outgoing',
        idMessage: 'ask',
        timestamp: 1_769_000_100,
        textMessage: '/start',
      }),
    ])

    expect(state.messages['100500'].map((item) => item.text)).toEqual(['/start', 'ответ'])
    expect(chatOf(state, '100500')?.lastMessage).toBe('ответ')
  })

  it('does not duplicate a message the journal already delivered', () => {
    const withJournal = mergeJournal(withChats('100500'), [journal()])
    const state = mergeHistory(withJournal, '100500', [message()])

    expect(state.messages['100500']).toHaveLength(1)
  })

  it('marks an outgoing message of the history with the status of the API', () => {
    const state = mergeHistory(withChats('100500'), '100500', [
      message({ type: 'outgoing', statusMessage: 'read', textMessage: 'ответ' }),
    ])

    expect(state.messages['100500'][0]).toMatchObject({ direction: 'out', status: 'read' })
  })

  it('marks a message of the own chat as outgoing', () => {
    const state = mergeHistory(withChats('100500'), '100500', [message()], '100500')

    expect(state.messages['100500'][0]).toMatchObject({ direction: 'out', status: 'sent' })
  })

  it('keeps the status of the newest message as the status of the preview', () => {
    const state = mergeHistory(withChats('100500'), '100500', [
      message({ type: 'outgoing', statusMessage: 'read', textMessage: 'ответ' }),
    ])

    expect(chatOf(state, '100500')?.lastStatus).toBe('read')
  })

  it('leaves an incoming preview without a status', () => {
    const state = mergeHistory(withChats('100500'), '100500', [message()])

    expect(chatOf(state, '100500')?.lastStatus).toBeNull()
  })
})

describe('patchMessage', () => {
  it('shows a new status of the previewed message in the chat list', () => {
    const sent = mergeJournal(withChats('100500'), [
      journal({ type: 'outgoing', idMessage: 'out-1', statusMessage: 'sent' }),
    ])
    const state = applyNotification(sent, statusNotification('out-1', 'read'), null)

    expect(chatOf(state, '100500')?.lastStatus).toBe('read')
  })

  it('leaves the status of the preview alone for a message further back', () => {
    const previewed = mergeJournal(withChats('100500'), [
      journal({
        type: 'outgoing',
        idMessage: 'out-1',
        timestamp: 1_769_000_500,
        statusMessage: 'sent',
      }),
    ])
    const withOlder = mergeJournal(previewed, [
      journal({
        type: 'outgoing',
        idMessage: 'out-0',
        timestamp: 1_769_000_100,
        statusMessage: 'sent',
      }),
    ])
    const state = applyNotification(withOlder, statusNotification('out-0', 'read'), null)

    expect(chatOf(state, '100500')?.lastStatus).toBe('sent')
  })

  it('drops the status of the preview when the newest message is an incoming one', () => {
    const first = mergeJournal(withChats('100500'), [
      journal({ type: 'outgoing', idMessage: 'out-1', statusMessage: 'read' }),
    ])
    const state = mergeJournal(first, [
      journal({ idMessage: 'in-1', timestamp: 1_769_000_500, textMessage: 'ответ' }),
    ])

    expect(chatOf(state, '100500')?.lastStatus).toBeNull()
  })
})

describe('profileLoading', () => {
  it('marks a chat created without a name until its profile is resolved', () => {
    const named = mergeChats(createStore(), [chatItem()])
    expect(chatOf(named, '100500')?.profileLoading).toBeUndefined()

    const nameless = mergeChats(createStore(), [chatItem({ name: '', username: '' })])
    expect(chatOf(nameless, '100500')?.profileLoading).toBe(true)

    const resolved = resolveProfile(nameless, '100500', { name: contactName })
    expect(chatOf(resolved, '100500')).toMatchObject({
      title: contactName,
      profileLoading: false,
    })
  })

  it('takes the avatar of a named chat and keeps its name', () => {
    const named = mergeChats(createStore(), [chatItem()])

    const resolved = resolveProfile(named, '100500', {
      name: 'Другое имя',
      avatar: 'https://a/b.jpg',
    })
    expect(chatOf(resolved, '100500')).toMatchObject({
      title: contactName,
      avatar: 'https://a/b.jpg',
    })
  })

  it('stops loading with the placeholder title when the profile fails', () => {
    const nameless = mergeChats(createStore(), [chatItem({ name: '', username: '' })])
    const title = chatOf(nameless, '100500')?.title

    const resolved = resolveProfile(nameless, '100500', null)
    expect(chatOf(resolved, '100500')).toMatchObject({ title, profileLoading: false })
  })

  it('stops loading as soon as a name arrives from another source', () => {
    const nameless = mergeChats(createStore(), [chatItem({ name: '', username: '' })])
    const named = mergeJournal(nameless, [journal({ senderName: contactName })])

    expect(chatOf(named, '100500')).toMatchObject({ title: contactName, profileLoading: false })
  })
})

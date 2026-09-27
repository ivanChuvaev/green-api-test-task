import type {
  Chat,
  ChatHistoryMessage,
  ChatListItem,
  ChatMessage,
  JournalMessage,
  NotificationBody,
  OutgoingStatus,
} from '../api/types'
import { formatPhone } from '../utils/format'

export interface StoreState {
  chats: Chat[]
  messages: Record<string, ChatMessage[]>
  byId: Map<string, ChatMessage>
}

export const createStore = (): StoreState => ({ chats: [], messages: {}, byId: new Map() })

export const toOutgoingStatus = (value: unknown): OutgoingStatus => {
  if (value === 'read' || value === 'Read') return 'read'
  if (value === 'delivered' || value === 'Delivered') return 'delivered'
  if (value === 'failed' || value === 'Failed') return 'failed'
  return 'sent'
}

const attachmentLabels: Partial<Record<string, string>> = {
  imageMessage: 'Фото',
  videoMessage: 'Видео',
  documentMessage: 'Документ',
  audioMessage: 'Аудио',
  stickerMessage: 'Стикер',
  locationMessage: 'Геопозиция',
  contactMessage: 'Контакт',
  pollMessage: 'Опрос',
}

type MessageContent = Pick<ChatMessage, 'text' | 'attachment'>

const readContent = (typeMessage: string | undefined, text: string): MessageContent | null => {
  const attachment = typeMessage ? attachmentLabels[typeMessage] : undefined
  if (attachment) return { text, attachment }
  return text ? { text } : null
}

const notificationText = (body: NotificationBody): string => {
  const data = body.messageData
  return (
    data?.textMessageData?.textMessage ||
    data?.extendedTextMessageData?.text ||
    data?.fileMessageData?.caption ||
    ''
  )
}

export const previewOf = (message: MessageContent): string => {
  if (!message.attachment) return message.text
  return message.text ? `${message.attachment}: ${message.text}` : message.attachment
}

const previewStatus = (message: ChatMessage): OutgoingStatus | null =>
  message.direction === 'out' ? message.status : null

export interface ChatSeed {
  chatId: string
  title?: string
  phone?: string
  avatar?: string
  lastActivity?: number
}

export const upsertChat = (state: StoreState, seed: ChatSeed): StoreState => {
  const existing = state.chats.find((chat) => chat.chatId === seed.chatId)

  if (!existing) {
    const chat: Chat = {
      chatId: seed.chatId,
      title: seed.title || formatPhone(seed.phone ?? '') || seed.chatId,
      phone: seed.phone ?? '',
      avatar: seed.avatar ?? '',
      unread: 0,
      lastActivity: seed.lastActivity ?? Date.now(),
      lastMessage: '',
      lastStatus: null,
      ...(seed.title ? {} : { profileLoading: true }),
    }
    return { ...state, chats: [chat, ...state.chats] }
  }

  const merged: Chat = {
    ...existing,
    title: seed.title || existing.title,
    phone: seed.phone || existing.phone,
    avatar: seed.avatar || existing.avatar,
    ...(seed.title && existing.profileLoading ? { profileLoading: false } : {}),
  }

  return {
    ...state,
    chats: state.chats.map((chat) => (chat.chatId === seed.chatId ? merged : chat)),
  }
}

export const resolveProfile = (
  state: StoreState,
  chatId: string,
  info: { name?: string; contactName?: string; avatar?: string } | null,
): StoreState => ({
  ...state,
  chats: state.chats.map((chat) =>
    chat.chatId === chatId
      ? {
          ...chat,
          title: chat.profileLoading ? info?.name || info?.contactName || chat.title : chat.title,
          avatar: info?.avatar || chat.avatar,
          profileLoading: false,
        }
      : chat,
  ),
})

export const patchMessage = (
  state: StoreState,
  id: string,
  patch: Partial<ChatMessage>,
): StoreState => {
  const known = state.byId.get(id)
  if (!known) return state

  const updated = { ...known, ...patch }
  const byId = new Map(state.byId)
  byId.set(id, updated)
  const list = state.messages[known.chatId] ?? []
  const merged = list.map((message) => (message.id === id ? updated : message))
  const messages = { ...state.messages, [known.chatId]: merged }

  const newest = merged[merged.length - 1]
  const chats =
    newest?.id === updated.id
      ? state.chats.map((chat) =>
          chat.chatId === known.chatId ? { ...chat, lastStatus: previewStatus(newest) } : chat,
        )
      : state.chats

  return { chats, messages, byId }
}

// Timestamps are in whole seconds, so a reply can tie with the message it answers.
const compareMessages = (a: ChatMessage, b: ChatMessage): number => {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
  if (a.direction === b.direction) return 0
  return a.direction === 'out' ? -1 : 1
}

const indexFor = (list: ChatMessage[], message: ChatMessage): number => {
  let index = list.length
  while (index > 0 && compareMessages(list[index - 1], message) > 0) index -= 1
  return index
}

export const appendMessage = (
  state: StoreState,
  message: ChatMessage,
  unreadDelta: number,
): StoreState => {
  const known = state.byId.get(message.id)
  if (known) return patchMessage(state, message.id, { status: message.status })

  const byId = new Map(state.byId)
  byId.set(message.id, message)

  const list = state.messages[message.chatId] ?? []
  const index = indexFor(list, message)
  const isNewest = index === list.length
  const merged = isNewest
    ? [...list, message]
    : [...list.slice(0, index), message, ...list.slice(index)]
  const messages = { ...state.messages, [message.chatId]: merged }

  const existing = state.chats.find((chat) => chat.chatId === message.chatId)
  const chats = !existing
    ? state.chats
    : isNewest
      ? [
          {
            ...existing,
            lastActivity: message.timestamp,
            lastMessage: previewOf(message),
            lastStatus: previewStatus(message),
            unread: Math.max(0, existing.unread + unreadDelta),
          },
          ...state.chats.filter((chat) => chat.chatId !== message.chatId),
        ]
      : state.chats.map((chat) =>
          chat.chatId === message.chatId
            ? { ...chat, unread: Math.max(0, chat.unread + unreadDelta) }
            : chat,
        )

  return { chats, messages, byId }
}

export const applyNotification = (
  state: StoreState,
  body: NotificationBody,
  activeChatId: string | null,
): StoreState => {
  const sender = body.senderData
  const chatId = sender?.chatId || body.chatId || ''

  if (body.typeWebhook === 'outgoingMessageStatus') {
    return patchMessage(state, body.idMessage, { status: toOutgoingStatus(body.status) })
  }

  if (!chatId) return state

  const isIncoming = body.typeWebhook === 'incomingMessageReceived'
  const isOutgoing =
    body.typeWebhook === 'outgoingAPIMessageReceived' ||
    body.typeWebhook === 'outgoingMessageReceived'

  if (!isIncoming && !isOutgoing) return state

  const content = readContent(body.messageData?.typeMessage, notificationText(body))
  if (!content) return state

  const known = state.byId.has(body.idMessage)
  const isActive = activeChatId === chatId

  const fromContact = isIncoming && sender?.sender === chatId
  const hasChat = state.chats.some((chat) => chat.chatId === chatId)
  const title = fromContact
    ? sender.senderContactName || sender.senderName || sender.chatName
    : hasChat
      ? undefined
      : sender?.chatName

  const withChat = upsertChat(state, {
    chatId,
    title,
    phone: fromContact && sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : '',
  })

  return appendMessage(
    withChat,
    {
      id: body.idMessage,
      chatId,
      ...content,
      direction: isOutgoing ? 'out' : 'in',
      timestamp: (body.timestamp || Math.floor(Date.now() / 1000)) * 1000,
      status: isOutgoing ? 'sent' : 'read',
    },
    known || isOutgoing || isActive ? 0 : 1,
  )
}

export const renameMessage = (state: StoreState, fromId: string, toId: string): StoreState => {
  const known = state.byId.get(fromId)
  if (!known) return state

  const renamed: ChatMessage = {
    ...known,
    id: toId,
    localId: known.localId ?? fromId,
    status: known.status === 'pending' ? 'sent' : known.status,
  }
  const byId = new Map(state.byId)
  byId.delete(fromId)
  byId.set(toId, renamed)

  return {
    chats: state.chats,
    byId,
    messages: {
      ...state.messages,
      [known.chatId]: (state.messages[known.chatId] ?? []).map((message) =>
        message.id === fromId ? renamed : message,
      ),
    },
  }
}

export const markRead = (state: StoreState, chatId: string): StoreState => ({
  ...state,
  chats: state.chats.map((chat) => (chat.chatId === chatId ? { ...chat, unread: 0 } : chat)),
})

export const mergeChats = (state: StoreState, items: ChatListItem[]): StoreState =>
  items.reduce(
    (current, item) =>
      upsertChat(current, {
        chatId: item.chatId,
        title: item.name || item.username,
        phone: item.phoneNumber ? String(item.phoneNumber) : '',
        lastActivity: 0,
      }),
    state,
  )

const toMessage = (item: ChatHistoryMessage, ownChatId?: string): ChatMessage | null => {
  if (item.isDeleted) return null

  const content = readContent(
    item.typeMessage,
    item.textMessage || item.extendedTextMessage?.text || item.caption || '',
  )
  if (!content) return null

  const outgoing = item.type === 'outgoing' || Boolean(ownChatId && item.chatId === ownChatId)

  return {
    id: item.idMessage,
    chatId: item.chatId,
    ...content,
    direction: outgoing ? 'out' : 'in',
    timestamp: item.timestamp * 1000,
    status: outgoing ? toOutgoingStatus(item.statusMessage) : 'read',
  }
}

const journalTitle = (item: JournalMessage) =>
  item.type === 'incoming' && item.senderId === item.chatId
    ? item.senderContactName || item.senderName
    : undefined

export const mergeJournal = (
  state: StoreState,
  items: JournalMessage[],
  ownChatId?: string,
): StoreState =>
  [...items]
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((current, item) => {
      const message = toMessage(item, ownChatId)
      if (!message) return current

      const withChat = upsertChat(current, { chatId: item.chatId, title: journalTitle(item) })
      return appendMessage(withChat, message, 0)
    }, state)

export const mergeHistory = (
  state: StoreState,
  chatId: string,
  items: ChatHistoryMessage[],
  ownChatId?: string,
): StoreState => {
  const existing = state.messages[chatId] ?? []
  const known = new Set(existing.map((message) => message.id))
  // `getChatHistory` lists the newest message first.
  const fresh = [...items]
    .reverse()
    .filter((item) => !known.has(item.idMessage))
    .map((item) => toMessage(item, ownChatId))
    .filter((message) => message !== null)

  if (fresh.length === 0) return state

  const messages = [...existing, ...fresh].sort(compareMessages)
  const byId = new Map(state.byId)
  for (const message of messages) byId.set(message.id, message)

  const newest = messages[messages.length - 1]
  const chats = state.chats.map((chat) =>
    chat.chatId === chatId
      ? {
          ...chat,
          lastActivity: newest.timestamp,
          lastMessage: previewOf(newest),
          lastStatus: previewStatus(newest),
        }
      : chat,
  )

  return { chats, messages: { ...state.messages, [chatId]: messages }, byId }
}

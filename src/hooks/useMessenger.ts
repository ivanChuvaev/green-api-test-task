import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  GreenApiError,
  QUOTA_EXCEEDED_STATUS,
  RECEIVE_TIMEOUT_SECONDS,
  checkAccount,
  deleteNotification,
  describeInstanceState,
  getAccountSettings,
  getChatHistory,
  getChats,
  getContactInfo,
  getLastIncomingMessages,
  getLastOutgoingMessages,
  getSettings,
  getStateInstance,
  receiveNotification,
  sendMessage,
  setSettings,
} from '../api/greenApi'
import type {
  AccountSettings,
  AccountTarget,
  Chat,
  ChatMessage,
  Credentials,
  CurrentUser,
  InstanceSettings,
  JournalMessage,
} from '../api/types'
import { formatPhone, normalizePhone } from '../utils/format'
import { toastDefaults } from '../lib/toast'
import {
  appendMessage,
  applyNotification,
  createStore,
  markRead,
  mergeChats,
  mergeHistory,
  mergeJournal,
  patchMessage,
  renameMessage,
  toOutgoingStatus,
  resolveProfile,
  upsertChat,
  type StoreState,
} from './messengerStore'

export type ConnectionStatus = 'connecting' | 'online' | 'unauthorized' | 'error'

export const HISTORY_LIMIT = 100

export const SELF_CHAT_TITLE = 'Избранное'

const PROBE_TIMEOUT_SECONDS = 5
const MAX_BACKOFF_MS = 15_000

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/

export const PHONE_EXAMPLE = '+7 (000) 000-00-00'
export const USERNAME_EXAMPLE = '@username'

export const INVALID_TARGET_MESSAGE = `Введите номер в международном формате (${PHONE_EXAMPLE}) или имя пользователя (${USERNAME_EXAMPLE})`

export const TARGET_NOT_FOUND_MESSAGE = `Аккаунт с номером ${PHONE_EXAMPLE} или именем ${USERNAME_EXAMPLE} не найден`

export const parseAccountTarget = (value: string): AccountTarget | null => {
  const trimmed = value.trim()

  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1)
    return USERNAME_PATTERN.test(username) ? { username: `@${username}` } : null
  }

  const digits = normalizePhone(trimmed)
  return digits.length >= 10 && digits.length <= 15 ? { phoneNumber: digits } : null
}

export interface MessengerApi {
  currentUser: CurrentUser | null
  settings: InstanceSettings | null
  connection: ConnectionStatus
  connectionError: string | null
  notificationsEnabled: boolean
  notificationsBusy: boolean
  enableNotifications: () => Promise<void>
  needsAttention: boolean
  chats: Chat[]
  messages: ChatMessage[]
  activeChat: Chat | null
  activeChatId: string | null
  historyLoading: boolean
  dialogsLoading: boolean
  ownNameSettled: boolean
  selectChat: (chatId: string) => void
  findChat: (input: string) => Promise<Chat>
  send: (chatId: string, text: string) => Promise<void>
  refreshAccount: () => Promise<void>
}

const loadCurrentUser = async (
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<CurrentUser> => {
  const account: AccountSettings = await getAccountSettings(credentials, signal)

  return {
    name: '',
    username: account.username || '',
    phone: account.phone,
    avatar: account.avatar || '',
    chatId: account.chatId,
  }
}

const ownNameFrom = (messages: JournalMessage[], chatId: string) => {
  if (!chatId) return ''
  const own = messages.find(
    (message) =>
      Boolean(message.senderName) && (message.senderId === chatId || message.chatId === chatId),
  )
  return own?.senderName ?? ''
}

export const useMessenger = (credentials: Credentials): MessengerApi => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [settings, setInstanceSettings] = useState<InstanceSettings | null>(null)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [notificationsBusy, setNotificationsBusy] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [dialogsLoading, setDialogsLoading] = useState(true)
  const [ownNameSettled, setOwnNameSettled] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Chat | null>(null)
  const [store, setStore] = useState<StoreState>(createStore)

  const activeChatIdRef = useRef<string | null>(null)
  const ownChatIdRef = useRef<string | null>(null)
  const ownNameRef = useRef('')
  const historyController = useRef<AbortController | null>(null)
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  // Not an effect: the dialogs and the notifications can answer before the next render.
  const publishCurrentUser = useCallback((user: CurrentUser) => {
    ownChatIdRef.current = user.chatId
    setCurrentUser(user)
  }, [])

  const rememberOwnName = useCallback((name: string) => {
    if (!name) return
    ownNameRef.current = name
    setCurrentUser((current) => (current && !current.name ? { ...current, name } : current))
  }, [])

  const loadInstanceInfo = useCallback(
    async (options: { signal?: AbortSignal } = {}): Promise<boolean> => {
      const { signal } = options

      try {
        const [state, user] = await Promise.all([
          getStateInstance(credentials, signal),
          loadCurrentUser(credentials, signal),
        ])

        publishCurrentUser({ ...user, name: user.name || ownNameRef.current })
        setInstanceSettings(await getSettings(credentials, { signal }))

        const authorized = state.stateInstance === 'authorized'
        setConnection(authorized ? 'online' : 'unauthorized')
        setConnectionError(authorized ? null : describeInstanceState(state.stateInstance))
        return true
      } catch (error) {
        if (isAbort(error)) return false
        setConnection('error')
        setConnectionError(
          error instanceof GreenApiError ? error.message : 'Не удалось получить данные инстанса',
        )
        return false
      }
    },
    [credentials, publishCurrentUser],
  )

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      let delay = 5000
      while (!(await loadInstanceInfo({ signal: controller.signal }))) {
        if (controller.signal.aborted) return
        await sleep(delay)
        if (controller.signal.aborted) return
        delay = Math.min(delay * 2, 60_000)
      }
    }

    void load()
    return () => controller.abort()
  }, [loadInstanceInfo])

  const isUnauthorized = connection === 'unauthorized'

  useEffect(() => {
    if (isUnauthorized) return

    const controller = new AbortController()
    let backoff = 1000
    let failing = false

    const recover = () => {
      if (!failing) return
      failing = false
      setConnection((current) => (current === 'error' ? 'online' : current))
      setConnectionError(null)
    }

    const loop = async () => {
      while (!controller.signal.aborted) {
        try {
          const notification = await receiveNotification(
            credentials,
            failing ? PROBE_TIMEOUT_SECONDS : RECEIVE_TIMEOUT_SECONDS,
            controller.signal,
          )

          recover()

          if (notification?.body) {
            const body = notification.body
            const readingChatId = document.hidden ? null : activeChatIdRef.current
            setStore((current) => applyNotification(current, body, readingChatId))

            if (body.typeWebhook === 'outgoingMessageReceived') {
              rememberOwnName(body.senderData?.senderName ?? '')
            }

            if (
              body.typeWebhook === 'outgoingMessageStatus' &&
              toOutgoingStatus(body.status) === 'failed'
            ) {
              toast.error(
                body.description
                  ? `Сообщение не отправлено: ${body.description}`
                  : 'Сообщение не отправлено',
                toastDefaults,
              )
            }
          }

          if (notification) {
            await deleteNotification(credentials, notification.receiptId)
          }

          backoff = 1000
        } catch (error) {
          if (controller.signal.aborted || isAbort(error)) return

          const emptyPoll =
            error instanceof GreenApiError && (error.status === 408 || error.status === 499)
          const unavailable = error instanceof GreenApiError && error.status >= 500
          const rateLimited = error instanceof GreenApiError && error.status === 429

          if (emptyPoll) {
            recover()
            backoff = 1000
            continue
          }

          if (!unavailable && !rateLimited) {
            failing = true
            setConnection('error')
            setConnectionError(
              error instanceof GreenApiError
                ? error.message
                : 'Нет связи с GREEN-API, повторяем попытку…',
            )
          }

          await sleep(backoff)
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
        }
      }
    }

    void loop()
    return () => controller.abort()
  }, [isUnauthorized, credentials, rememberOwnName])

  const enableNotifications = useCallback(async () => {
    setNotificationsBusy(true)
    try {
      await setSettings(credentials, {
        webhookUrl: '',
        incomingWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
        outgoingWebhook: 'yes',
        outgoingAPIMessageWebhook: 'yes',
        stateWebhook: 'yes',
      })
      setInstanceSettings(await getSettings(credentials, { fresh: true }))
    } finally {
      setNotificationsBusy(false)
    }
  }, [credentials])

  const loadDialogs = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const items = await getChats(credentials, signal)
        setStore((current) => mergeChats(current, items ?? []))
      } catch (error) {
        if (isAbort(error)) return
      } finally {
        if (!signal?.aborted) setDialogsLoading(false)
      }

      try {
        const [incoming, outgoing] = await Promise.all([
          getLastIncomingMessages(credentials, signal),
          getLastOutgoingMessages(credentials, signal),
        ])
        const messages = [...(incoming ?? []), ...(outgoing ?? [])]
        rememberOwnName(ownNameFrom(messages, ownChatIdRef.current ?? ''))
        setStore((current) => mergeJournal(current, messages, ownChatIdRef.current ?? undefined))
      } catch (error) {
        if (isAbort(error)) return
      }
      if (!signal?.aborted) setOwnNameSettled(true)
    },
    [credentials, rememberOwnName],
  )

  const loadHistory = useCallback(
    async (chatId: string) => {
      historyController.current?.abort()
      const controller = new AbortController()
      historyController.current = controller
      setHistoryLoading(true)

      try {
        const items = await getChatHistory(credentials, chatId, HISTORY_LIMIT, controller.signal)
        setStore((current) =>
          mergeHistory(current, chatId, items ?? [], ownChatIdRef.current ?? undefined),
        )
      } catch (error) {
        if (isAbort(error)) return
      } finally {
        if (historyController.current === controller) {
          historyController.current = null
          if (!controller.signal.aborted) setHistoryLoading(false)
        }
      }
    },
    [credentials],
  )

  const ownChatId = currentUser?.chatId

  useEffect(() => {
    if (isUnauthorized || !ownChatId) return

    const controller = new AbortController()
    void loadDialogs(controller.signal)
    return () => controller.abort()
  }, [isUnauthorized, ownChatId, loadDialogs])

  useEffect(() => () => historyController.current?.abort(), [])

  useEffect(() => {
    const onVisibilityChange = () => {
      const chatId = activeChatIdRef.current
      if (!document.hidden && chatId) setStore((current) => markRead(current, chatId))
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const profileController = useRef<AbortController | null>(null)
  const profilesRequested = useRef(new Set<string>())
  const [profilesExhausted, setProfilesExhausted] = useState(false)
  const profilesExhaustedRef = useRef(false)

  const markProfilesExhausted = useCallback(() => {
    profilesExhaustedRef.current = true
    setProfilesExhausted(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    profileController.current = controller
    profilesRequested.current.clear()
    return () => controller.abort()
  }, [credentials])

  useEffect(() => {
    const controller = profileController.current
    if (isUnauthorized || profilesExhausted || !controller) return

    for (const chat of store.chats) {
      if (!(chat.profileLoading || !chat.avatar) || profilesRequested.current.has(chat.chatId))
        continue
      profilesRequested.current.add(chat.chatId)

      getContactInfo(credentials, chat.chatId, {
        signal: controller.signal,
        priority: 'background',
      }).then(
        (info) => setStore((current) => resolveProfile(current, chat.chatId, info)),
        (error: unknown) => {
          if (isAbort(error)) return
          if (error instanceof GreenApiError && error.status === QUOTA_EXCEEDED_STATUS) {
            markProfilesExhausted()
            controller.abort()
            return
          }
          setStore((current) => resolveProfile(current, chat.chatId, null))
        },
      )
    }
  }, [store.chats, isUnauthorized, profilesExhausted, credentials, markProfilesExhausted])

  const selectChat = useCallback(
    (chatId: string) => {
      setResolved((current) => (chatId && current?.chatId === chatId ? current : null))

      if (!chatId) {
        setActiveChatId(null)
        return
      }
      setActiveChatId(chatId)
      setStore((current) => markRead(current, chatId))
      void loadHistory(chatId)
    },
    [loadHistory],
  )

  const findChat = useCallback(
    async (input: string): Promise<Chat> => {
      const target = parseAccountTarget(input)
      if (!target) throw new Error(INVALID_TARGET_MESSAGE)

      const digits = 'phoneNumber' in target ? target.phoneNumber : ''
      const username = 'username' in target ? target.username : ''
      const result = await checkAccount(credentials, target)
      if (!result?.exist) {
        throw new Error(TARGET_NOT_FOUND_MESSAGE)
      }

      const chatId = result.chatId || digits || username
      const info = profilesExhaustedRef.current
        ? null
        : await getContactInfo(credentials, chatId).catch((error: unknown) => {
            if (error instanceof GreenApiError && error.status === QUOTA_EXCEEDED_STATUS) {
              markProfilesExhausted()
            }
            return null
          })

      const phone = digits || (result.phoneNumber ? String(result.phoneNumber) : '')
      const title = info?.name || result.username || (phone ? formatPhone(phone) : username)

      const contact: Chat = {
        chatId,
        title,
        phone,
        avatar: info?.avatar ?? '',
        unread: 0,
        lastActivity: Date.now(),
        lastMessage: '',
        lastStatus: null,
      }

      selectChat(chatId)
      setResolved(contact)

      return contact
    },
    [selectChat, credentials, markProfilesExhausted],
  )

  const send = useCallback(
    async (chatId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const optimistic: ChatMessage = {
        id: tempId,
        chatId,
        text: trimmed,
        direction: 'out',
        // Whole seconds like the API, or a same-second reply would sort before it.
        timestamp: Math.floor(Date.now() / 1000) * 1000,
        status: 'pending',
      }

      const seed = resolved?.chatId === chatId ? resolved : null

      setStore((current) => {
        const withRow =
          seed && !current.chats.some((chat) => chat.chatId === chatId)
            ? upsertChat(current, seed)
            : current
        return appendMessage(withRow, optimistic, 0)
      })

      if (seed) setResolved(null)

      try {
        const response = await sendMessage(credentials, chatId, trimmed)
        setStore((current) => renameMessage(current, tempId, response.idMessage))
      } catch (error) {
        setStore((current) => patchMessage(current, tempId, { status: 'failed' }))
        throw error
      }
    },
    [credentials, resolved],
  )

  const refreshAccount = useCallback(async () => {
    setConnection('connecting')
    setConnectionError(null)
    await loadInstanceInfo()
  }, [loadInstanceInfo])

  const chats = useMemo(
    () =>
      store.chats.map((chat) =>
        chat.chatId === ownChatId
          ? { ...chat, title: SELF_CHAT_TITLE, profileLoading: false }
          : profilesExhausted && chat.profileLoading
            ? { ...chat, profileLoading: false }
            : chat,
      ),
    [store.chats, ownChatId, profilesExhausted],
  )

  const notificationsEnabled = settings?.incomingWebhook === 'yes'

  const needsAttention =
    connection === 'connecting' ||
    connection === 'error' ||
    connection === 'unauthorized' ||
    (connection === 'online' && !notificationsEnabled)

  return {
    currentUser,
    settings,
    connection,
    connectionError,
    notificationsEnabled,
    notificationsBusy,
    enableNotifications,
    needsAttention,
    chats,
    messages: activeChatId ? (store.messages[activeChatId] ?? []) : [],
    activeChat:
      chats.find((chat) => chat.chatId === activeChatId) ??
      (resolved?.chatId === activeChatId ? resolved : null),
    activeChatId,
    historyLoading,
    dialogsLoading,
    ownNameSettled,
    selectChat,
    findChat,
    send,
    refreshAccount,
  }
}

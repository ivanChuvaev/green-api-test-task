import type {
  AccountSettings,
  AccountTarget,
  ChatHistoryMessage,
  ChatListItem,
  JournalMessage,
  CheckAccountResult,
  ContactInfo,
  Credentials,
  InstanceSettings,
  InstanceState,
  Notification,
} from './types'

export const RECEIVE_TIMEOUT_SECONDS = 25
export const MAX_MESSAGE_LENGTH = 4096

export class GreenApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
    this.payload = payload
  }
}

const stripSlashes = (value: string) => value.trim().replace(/\/+$/, '')

export const buildUrl = (
  credentials: Credentials,
  method: string,
  suffix = '',
  query?: Record<string, string | number | undefined>,
) => {
  const base = stripSlashes(credentials.apiUrl)
  const url = `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${suffix}`
  const params = new URLSearchParams()

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
  }

  const search = params.toString()
  return search ? `${url}?${search}` : url
}

const parsePayload = async (response: Response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const describe = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload) return payload
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['message', 'error', 'reason', 'details'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value) return value
    }
  }
  return fallback
}

const statusHints: Record<number, string> = {
  0: 'Нет связи с GREEN-API. Проверьте API URL и подключение к сети.',
  401: 'GREEN-API отклонил токен (HTTP 401). Проверьте apiTokenInstance.',
  403: 'GREEN-API отклонил доступ (HTTP 403). Проверьте idInstance и адрес API.',
  404: 'Метод не найден (HTTP 404). Проверьте API URL и версию GREEN-API.',
  429: 'Превышен лимит запросов к GREEN-API. Повторите попытку через секунду.',
  466: 'Исчерпана квота метода на тарифе GREEN-API (HTTP 466).',
  500: 'GREEN-API временно недоступен (HTTP 500). Повторите попытку через минуту.',
  502: 'GREEN-API временно недоступен (HTTP 502). Повторите попытку через минуту.',
  503: 'GREEN-API временно недоступен (HTTP 503). Повторите попытку через минуту.',
  504: 'GREEN-API не успел ответить (HTTP 504). Повторите попытку.',
}

export type RequestPriority = 'foreground' | 'background'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  suffix?: string
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  skipQueue?: boolean
  priority?: RequestPriority
}

const MIN_REQUEST_GAP_MS = 1100

const JOURNAL_MINUTES = 1440

interface Job {
  start: () => Promise<void>
}

const jobs: Record<RequestPriority, Job[]> = { foreground: [], background: [] }
let draining = false
let lastRequestAt = 0

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const abortError = () => new DOMException('The request was aborted', 'AbortError')

const drain = async () => {
  if (draining) return
  draining = true

  while (jobs.foreground.length > 0 || jobs.background.length > 0) {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt)
    if (wait > 0) await sleep(wait)

    const job = jobs.foreground.shift() ?? jobs.background.shift()
    if (!job) continue

    lastRequestAt = Date.now()
    await job.start()
  }

  draining = false
}

const enqueue = <T>(
  task: () => Promise<T>,
  priority: RequestPriority,
  signal?: AbortSignal,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const onAbort = () => {
      jobs[priority] = jobs[priority].filter((queued) => queued !== job)
      reject(abortError())
    }

    const job: Job = {
      start: () => {
        signal?.removeEventListener('abort', onAbort)
        return task().then(resolve, reject)
      },
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    jobs[priority].push(job)
    void drain()
  })

export const request = async <T>(
  credentials: Credentials,
  method: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    method: httpMethod = 'GET',
    body,
    suffix = '',
    query,
    signal,
    timeoutMs = 60_000,
    skipQueue = false,
    priority = 'foreground',
  } = options

  const execute = async (): Promise<T> => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)

    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const response = await fetch(buildUrl(credentials, method, suffix, query), {
        method: httpMethod,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })

      const payload = await parsePayload(response)

      if (!response.ok) {
        const apiMessage = describe(payload, '')
        throw new GreenApiError(
          apiMessage || statusHints[response.status] || `HTTP ${response.status}`,
          response.status,
          payload,
        )
      }

      if (
        payload &&
        typeof payload === 'object' &&
        'status' in (payload as Record<string, unknown>)
      ) {
        const record = payload as Record<string, unknown>
        if (record.status === false || record.status === 'false') {
          throw new GreenApiError(
            describe(record, 'GREEN-API returned an error'),
            response.status,
            payload,
          )
        }
      }

      return payload as T
    } catch (error) {
      if (error instanceof GreenApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new GreenApiError(statusHints[0], 0)
    } finally {
      window.clearTimeout(timer)
    }
  }

  return skipQueue ? execute() : enqueue(execute, priority, signal)
}

const CACHE_TTL_MS = 3000
const cache = new Map<string, { at: number; value: unknown }>()

const requestCached = async <T>(
  credentials: Credentials,
  method: string,
  options: RequestOptions = {},
): Promise<T> => {
  const key = `${method}|${buildUrl(credentials, method)}`
  const hit = cache.get(key)

  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value as T
  }

  const value = await request<T>(credentials, method, options)
  cache.set(key, { at: Date.now(), value })
  return value
}

export const getStateInstance = (credentials: Credentials, signal?: AbortSignal) =>
  requestCached<{ stateInstance: InstanceState }>(credentials, 'getStateInstance', { signal })

const instanceStateHints: Record<Exclude<InstanceState, 'authorized'>, string> = {
  notAuthorized: 'Инстанс не авторизован: привяжите аккаунт в личном кабинете GREEN-API.',
  starting: 'Инстанс запускается. Повторите попытку через минуту.',
  blocked: 'Аккаунт инстанса заблокирован мессенджером.',
  sleepMode: 'Инстанс в спящем режиме: откройте мессенджер на телефоне.',
  yellowCard: 'Отправка сообщений временно ограничена мессенджером.',
}

export const describeInstanceState = (state: InstanceState) =>
  state === 'authorized'
    ? ''
    : (instanceStateHints[state] ?? `Инстанс недоступен (stateInstance: ${state})`)

export const getAccountSettings = (credentials: Credentials, signal?: AbortSignal) =>
  requestCached<AccountSettings>(credentials, 'getAccountSettings', { signal })

export const getSettings = (
  credentials: Credentials,
  options: { signal?: AbortSignal; fresh?: boolean } = {},
) =>
  options.fresh
    ? request<InstanceSettings>(credentials, 'getSettings', { signal: options.signal })
    : requestCached<InstanceSettings>(credentials, 'getSettings', { signal: options.signal })

export const setSettings = (credentials: Credentials, body: Record<string, string>) =>
  request<{ saveSettings?: boolean }>(credentials, 'setSettings', { method: 'POST', body })

export const checkAccount = (
  credentials: Credentials,
  target: AccountTarget,
  signal?: AbortSignal,
): Promise<CheckAccountResult> =>
  request<CheckAccountResult>(credentials, 'checkAccount', {
    method: 'POST',
    body:
      'phoneNumber' in target
        ? { phoneNumber: Number(target.phoneNumber) }
        : { username: target.username },
    signal,
  })

export const getContactInfo = (
  credentials: Credentials,
  chatId: string,
  options: { signal?: AbortSignal; priority?: RequestPriority } = {},
) =>
  request<ContactInfo>(credentials, 'getContactInfo', {
    method: 'POST',
    body: { chatId },
    ...options,
  })

export const QUOTA_EXCEEDED_STATUS = 466

export const getChats = (credentials: Credentials, signal?: AbortSignal) =>
  request<ChatListItem[]>(credentials, 'getChats', { signal })

export const getChatHistory = (
  credentials: Credentials,
  chatId: string,
  count: number,
  signal?: AbortSignal,
) =>
  request<ChatHistoryMessage[]>(credentials, 'getChatHistory', {
    method: 'POST',
    body: { chatId, count },
    signal,
  })

export const getLastIncomingMessages = (credentials: Credentials, signal?: AbortSignal) =>
  request<JournalMessage[]>(credentials, 'lastIncomingMessages', {
    query: { minutes: JOURNAL_MINUTES },
    signal,
  })

export const getLastOutgoingMessages = (credentials: Credentials, signal?: AbortSignal) =>
  request<JournalMessage[]>(credentials, 'lastOutgoingMessages', {
    query: { minutes: JOURNAL_MINUTES },
    signal,
  })

export const sendMessage = (credentials: Credentials, chatId: string, message: string) =>
  request<{ idMessage: string }>(credentials, 'sendMessage', {
    method: 'POST',
    body: { chatId, message },
  })

export const receiveNotification = (
  credentials: Credentials,
  receiveTimeout: number,
  signal?: AbortSignal,
) =>
  request<Notification | null>(credentials, 'receiveNotification', {
    query: { receiveTimeout },
    signal,
    timeoutMs: (receiveTimeout + 15) * 1000,
    skipQueue: true,
  })

export const deleteNotification = (credentials: Credentials, receiptId: number) =>
  request<{ result: boolean }>(credentials, 'deleteNotification', {
    method: 'DELETE',
    suffix: `/${receiptId}`,
  })

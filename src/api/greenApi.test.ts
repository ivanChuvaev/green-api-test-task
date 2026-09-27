import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { credentials } from '../test/fixtures'

// The request queue is module state, so every test imports a fresh copy.
const loadApi = async () => {
  vi.resetModules()
  return import('./greenApi')
}

const methodOf = (url: string) => url.split('/')[4]

let calls: { method: string; at: number }[] = []

beforeEach(() => {
  vi.useFakeTimers()
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push({ method: methodOf(url), at: Date.now() })
      return new Response('{}', { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('request queue', () => {
  it('keeps the requests of an instance about a second apart', async () => {
    const api = await loadApi()

    const done = Promise.all([
      api.getChats(credentials),
      api.getSettings(credentials),
      api.getLastIncomingMessages(credentials),
    ])
    await vi.runAllTimersAsync()
    await done

    expect(calls.map((call) => call.method)).toEqual([
      'getChats',
      'getSettings',
      'lastIncomingMessages',
    ])
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1100)
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(1100)
  })

  it('lets a request the user waits for overtake the background ones', async () => {
    const api = await loadApi()

    const done = Promise.all([
      api.getContactInfo(credentials, '1', { priority: 'background' }),
      api.getContactInfo(credentials, '2', { priority: 'background' }),
      api.sendMessage(credentials, '3', 'привет'),
    ])
    await vi.runAllTimersAsync()
    await done

    expect(calls.map((call) => call.method)).toEqual([
      'getContactInfo',
      'sendMessage',
      'getContactInfo',
    ])
  })

  it('drops a request aborted while it waits, without spending a slot on it', async () => {
    const api = await loadApi()
    const controller = new AbortController()

    const first = api.getChats(credentials)
    const aborted = api.getChatHistory(credentials, '1', 10, controller.signal)
    const third = api.getSettings(credentials)
    controller.abort()

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    await vi.runAllTimersAsync()
    await Promise.all([first, third])

    expect(calls.map((call) => call.method)).toEqual(['getChats', 'getSettings'])
    expect(calls[1].at - calls[0].at).toBeLessThan(2200)
  })

  it('explains a method whose monthly quota is used up', async () => {
    const api = await loadApi()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ invokeStatus: { status: 'QUOTE_EXCEEDED' } }), {
        status: 466,
      }),
    )

    const result = api.getContactInfo(credentials, '1')
    const assertion = expect(result).rejects.toMatchObject({
      status: api.QUOTA_EXCEEDED_STATUS,
      message: expect.stringContaining('квота'),
    })
    await vi.runAllTimersAsync()
    await assertion
  })
})

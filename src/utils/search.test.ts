import { describe, expect, it } from 'vitest'
import type { Chat } from '../api/types'
import { contact as contactInfo, contactName, contactPhone } from '../test/fixtures'
import { formatPhone } from './format'
import { matchesQuery, parseQuery, searchChats } from './search'

const chat = (seed: Partial<Chat> & { chatId: string }): Chat => ({
  title: '',
  phone: '',
  avatar: '',
  unread: 0,
  lastActivity: 0,
  lastMessage: '',
  lastStatus: null,
  ...seed,
})

const support = chat({
  chatId: '100500',
  title: 'Поддержка',
  phone: '79991234567',
  lastMessage: 'Ваш вопрос',
})

const contact = chat({
  chatId: contactInfo.chatId,
  title: contactName,
  phone: contactPhone,
  lastMessage: 'Проверка отправки',
})

const chats = [support, contact]

const titles = (found: Chat[]) => found.map((item) => item.chatId)

describe('matchesQuery', () => {
  it('accepts every chat for a blank query', () => {
    expect(chats.every((item) => matchesQuery(item, parseQuery('')))).toBe(true)
  })

  it('matches the name of a chat, whatever its case', () => {
    expect(matchesQuery(support, parseQuery('ПОДДЕРЖКА'))).toBe(true)
  })

  it('matches a part of a name, not only its beginning', () => {
    expect(matchesQuery(contact, parseQuery('контакт'))).toBe(true)
  })

  it('matches the number in any of its formats', () => {
    expect(matchesQuery(support, parseQuery('+7 (999) 123-45-67'))).toBe(true)
    expect(matchesQuery(support, parseQuery('7999123'))).toBe(true)
    expect(matchesQuery(support, parseQuery('999 123'))).toBe(true)
  })

  it('does not read a query without digits as a number', () => {
    expect(matchesQuery(contact, parseQuery('поддержка'))).toBe(false)
  })

  it('matches the preview of a message', () => {
    expect(matchesQuery(support, parseQuery('вопрос'))).toBe(true)
    expect(matchesQuery(contact, parseQuery('вопрос'))).toBe(false)
  })

  it('matches a title that is a formatted number', () => {
    const titled = chat({ chatId: '1', title: formatPhone('79991234567') })

    expect(matchesQuery(titled, parseQuery('999 123'))).toBe(true)
  })

  it('matches a title that is a @username', () => {
    const titled = chat({ chatId: '1', title: '@testcontact' })

    expect(matchesQuery(titled, parseQuery('testcontact'))).toBe(true)
  })

  it('rejects a query nothing answers', () => {
    expect(chats.some((item) => matchesQuery(item, parseQuery('нет-такого')))).toBe(false)
  })
})

describe('searchChats', () => {
  it('returns the very same array for a blank query', () => {
    expect(searchChats(chats, '')).toBe(chats)
    expect(searchChats(chats, '   ')).toBe(chats)
  })

  it('keeps only the chats that answer the query', () => {
    expect(titles(searchChats(chats, 'поддержка'))).toEqual(['100500'])
  })

  it('keeps the order of the store', () => {
    expect(titles(searchChats(chats, 'а'))).toEqual(titles(chats))
  })

  it('finds a chat by a digit of its number', () => {
    expect(titles(searchChats(chats, '999123'))).toEqual(['100500'])
  })

  it('returns nothing when no chat answers the query', () => {
    expect(searchChats(chats, 'нет-такого')).toEqual([])
  })
})

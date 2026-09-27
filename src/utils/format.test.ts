import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { account, contactName } from '../test/fixtures'
import {
  formatChatListTime,
  formatDaySeparator,
  formatPhone,
  initials,
  plural,
  splitLinks,
} from './format'

const at = (year: number, month: number, day: number, hours = 0, minutes = 0) =>
  new Date(year, month, day, hours, minutes).getTime()

const now = at(2026, 2, 15, 14, 30)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDaySeparator', () => {
  it('names the current day', () => {
    expect(formatDaySeparator(at(2026, 2, 15, 9, 0))).toBe('Сегодня')
  })

  it('names the day before the current one, whatever the time of it is', () => {
    expect(formatDaySeparator(at(2026, 2, 14, 23, 59))).toBe('Вчера')
    expect(formatDaySeparator(at(2026, 2, 14))).toBe('Вчера')
  })

  it('formats an older day as a day of its month', () => {
    expect(formatDaySeparator(at(2025, 11, 3, 10, 0))).toBe('3 декабря')
  })

  it('does not call the day before yesterday yesterday', () => {
    expect(formatDaySeparator(at(2026, 2, 13, 10, 0))).toBe('13 марта')
  })
})

describe('formatChatListTime', () => {
  it('renders the time of a message of the current day', () => {
    expect(formatChatListTime(at(2026, 2, 15, 9, 5))).toBe('09:05')
  })

  it('renders a message of an earlier day as a short date', () => {
    expect(formatChatListTime(at(2025, 11, 3, 10, 0))).toBe('03.12')
  })

  it('renders the first minute of the current day as a time, not as a date', () => {
    expect(formatChatListTime(at(2026, 2, 15))).toBe('00:00')
  })

  it('renders the last minute of the previous day as a date', () => {
    expect(formatChatListTime(at(2026, 2, 14, 23, 59))).toBe('14.03')
  })

  it('renders nothing for a chat that has no activity yet', () => {
    expect(formatChatListTime(0)).toBe('')
  })
})

describe('plural', () => {
  const chats: [string, string, string] = ['чат', 'чата', 'чатов']

  it.each<[number, string]>([
    [1, 'чат'],
    [2, 'чата'],
    [4, 'чата'],
    [5, 'чатов'],
    [11, 'чатов'],
    [12, 'чатов'],
    [14, 'чатов'],
    [0, 'чатов'],
    [21, 'чат'],
    [22, 'чата'],
    [25, 'чатов'],
    [101, 'чат'],
    [111, 'чатов'],
    [112, 'чатов'],
  ])('counts %i as %s', (count, expected) => {
    expect(plural(count, chats)).toBe(expected)
  })
})

describe('formatPhone', () => {
  it('groups a full Russian number', () => {
    expect(formatPhone('79001234567')).toBe('+7 900 123-45-67')
  })

  it('groups a number that is already written with separators', () => {
    expect(formatPhone('+7 (900) 123-45-67')).toBe('+7 900 123-45-67')
  })

  it('groups the number of the account fixture', () => {
    expect(formatPhone(account.phone)).toBe('+7 900 123-45-67')
  })

  it('prefixes a number of another country with a plus and its digits', () => {
    expect(formatPhone('+1 202 555 0143')).toBe('+12025550143')
  })

  it('keeps the last digit of a ten digit number', () => {
    expect(formatPhone('7123456789')).toBe('+7 123 456-78-9')
  })

  it('leaves a number that is not eleven or ten digits long ungrouped', () => {
    expect(formatPhone('8001234567')).toBe('+8001234567')
  })

  it('returns nothing for a value without digits', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone('@username')).toBe('')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words of a name', () => {
    expect(initials(contactName)).toBe('ТК')
  })

  it('takes two letters of a single word', () => {
    expect(initials('Иван')).toBe('ИВ')
  })

  it('keeps the first two words of a name with more than two of them', () => {
    expect(initials('Тестовый Контакт Второй')).toBe('ТК')
  })

  it('splits the words on dots, underscores and dashes too', () => {
    expect(initials('test.first_name')).toBe('TF')
    expect(initials('test-contact')).toBe('TC')
  })

  it('drops the punctuation a username starts with', () => {
    expect(initials('@testcontact')).toBe('TE')
  })

  it('falls back to a question mark for a title without a single word', () => {
    expect(initials('')).toBe('?')
    expect(initials('@')).toBe('?')
  })
})

describe('splitLinks', () => {
  it('keeps a text without links as one part', () => {
    expect(splitLinks('просто текст')).toEqual([{ text: 'просто текст' }])
  })

  it('cuts the links out of the text around them', () => {
    expect(splitLinks('см. https://green-api.com и http://example.com/a?b=1 тоже')).toEqual([
      { text: 'см. ' },
      { text: 'https://green-api.com', href: 'https://green-api.com' },
      { text: ' и ' },
      { text: 'http://example.com/a?b=1', href: 'http://example.com/a?b=1' },
      { text: ' тоже' },
    ])
  })

  it('leaves the punctuation after an address out of the link', () => {
    expect(splitLinks('[docs](https://core.telegram.org/bots).')).toEqual([
      { text: '[docs](' },
      { text: 'https://core.telegram.org/bots', href: 'https://core.telegram.org/bots' },
      { text: ').' },
    ])
  })
})

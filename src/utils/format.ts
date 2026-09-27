const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
})

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
})

export const formatTime = (timestamp: number) => timeFormatter.format(timestamp)

export const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const formatDaySeparator = (timestamp: number) => {
  const today = startOfDay(Date.now())
  const day = startOfDay(timestamp)
  if (day === today) return 'Сегодня'
  if (day === today - 86_400_000) return 'Вчера'
  return dateFormatter.format(timestamp)
}

export const formatChatListTime = (timestamp: number) => {
  if (!timestamp) return ''
  return startOfDay(timestamp) === startOfDay(Date.now())
    ? formatTime(timestamp)
    : shortDateFormatter.format(timestamp)
}

export const plural = (count: number, forms: [string, string, string]) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const normalizePhone = (value: string) => value.replace(/\D/g, '')

export const formatPhone = (value: string) => {
  const digits = normalizePhone(value)
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 10 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  return digits ? `+${digits}` : ''
}

export const initials = (title: string) => {
  const parts = title
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export interface TextPart {
  text: string
  href?: string
}

const LINK_PATTERN = /https?:\/\/[^\s<>"]+/g
const TRAILING_PUNCTUATION = /[.,;:!?'")\]]+$/

export const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = []
  let last = 0

  for (const match of text.matchAll(LINK_PATTERN)) {
    const href = match[0].replace(TRAILING_PUNCTUATION, '')
    const start = match.index
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: href, href })
    last = start + href.length
  }

  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

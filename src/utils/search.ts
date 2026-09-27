import type { Chat } from '../api/types'
import { normalizePhone } from './format'

export interface SearchQuery {
  text: string
  digits: string
}

export const parseQuery = (raw: string): SearchQuery => {
  const text = raw.trim().toLowerCase()

  return { text, digits: text ? normalizePhone(text) : '' }
}

export const matchesQuery = (chat: Chat, query: SearchQuery): boolean => {
  if (!query.text) return true
  if (chat.title.toLowerCase().includes(query.text)) return true
  if (chat.lastMessage.toLowerCase().includes(query.text)) return true
  return Boolean(query.digits) && normalizePhone(chat.phone).includes(query.digits)
}

export const searchChats = (chats: Chat[], raw: string): Chat[] => {
  const query = parseQuery(raw)
  if (!query.text) return chats
  return chats.filter((chat) => matchesQuery(chat, query))
}

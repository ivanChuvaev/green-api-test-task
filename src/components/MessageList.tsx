import { Spinner } from '@maxhub/max-ui'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import type { Chat, ChatMessage } from '../api/types'
import { HISTORY_LIMIT } from '../hooks/useMessenger'
import { formatDaySeparator, formatTime, splitLinks, startOfDay } from '../utils/format'
import { Icon } from './Icon'
import { MessageStatus } from './MessageStatus'
import styles from './Messages.module.scss'

interface MessageListProps {
  messages: ChatMessage[]
  chat: Chat
  loading?: boolean
}

interface Row {
  key: string
  separator?: string
  message?: ChatMessage
  incoming?: boolean
}

const PADDING_BLOCK = 20
const SCROLL_END_THRESHOLD = 80
const OVERSCAN = 8
const ROW_GAP = 6
const BUBBLE_HEIGHT = 50
const LINE_HEIGHT = 20
const CHARS_PER_LINE = 60
const SEPARATOR_HEIGHT = 42

const buildRows = (messages: ChatMessage[]): Row[] => {
  const rows: Row[] =
    messages.length >= HISTORY_LIMIT
      ? [{ key: 'history-notice', separator: `Загружены последние ${HISTORY_LIMIT} сообщений` }]
      : []
  let lastDay = 0

  for (const message of messages) {
    const day = startOfDay(message.timestamp)
    if (day !== lastDay) {
      rows.push({ key: `sep-${day}`, separator: formatDaySeparator(message.timestamp) })
      lastDay = day
    }
    rows.push({ key: message.localId ?? message.id, message, incoming: message.direction === 'in' })
  }

  return rows
}

const estimateRowHeight = (row: Row): number => {
  if (!row.message) return SEPARATOR_HEIGHT

  const { text, attachment } = row.message
  const textLines = text
    ? text
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0)
    : 0
  const lines = Math.max(1, textLines + (attachment && text ? 1 : 0))

  return BUBBLE_HEIGHT + (lines - 1) * LINE_HEIGHT
}

// The first range of a chat is computed before the scroll box exists, from offset 0 by default:
// it would render the oldest rows and leave the viewport at the end blank until a scroll event.
// Start from the estimated end instead, with the window as an upper bound of the box height.
const estimateEndOffset = (rows: Row[]) => {
  const content = rows.reduce((sum, row) => sum + estimateRowHeight(row) + ROW_GAP, 0) - ROW_GAP
  return Math.max(0, PADDING_BLOCK * 2 + content - window.innerHeight)
}

const StatusMark = ({ message }: { message: ChatMessage }) =>
  message.direction === 'in' ? null : <MessageStatus status={message.status} />

const MessageText = ({ text }: { text: string }) => (
  <span className={styles.bubbleText}>
    {splitLinks(text).map((part, index) =>
      part.href ? (
        <a
          key={index}
          className={styles.bubbleLink}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {part.text}
        </a>
      ) : (
        part.text
      ),
    )}
  </span>
)

const Bubble = memo(({ message }: { message: ChatMessage }) => (
  <div className={styles.bubble}>
    {message.attachment ? (
      <span className={styles.bubbleAttachment}>{message.attachment}</span>
    ) : null}
    {message.text ? <MessageText text={message.text} /> : null}
    <span className={styles.bubbleMeta}>
      <span className={styles.bubbleTime}>{formatTime(message.timestamp)}</span>
      <StatusMark message={message} />
    </span>
  </div>
))

const EmptyState = ({ chat, loading }: { chat: Chat; loading: boolean }) => (
  <div className={styles.emptyCard}>
    {loading ? (
      <div className={styles.emptyCardSpinner}>
        <Spinner size={24} />
      </div>
    ) : (
      <div className={styles.emptyCardMark}>
        <Icon name="chat" size={28} />
      </div>
    )}
    <h2 className={styles.emptyCardTitle}>{chat.title}</h2>
    <p className={styles.emptyCardText}>
      {loading
        ? 'Загружаем историю сообщений…'
        : 'Отправьте первое сообщение — ответ собеседника появится здесь автоматически.'}
    </p>
  </div>
)

const MessageRows = ({ chatId, messages }: { chatId: string; messages: ChatMessage[] }) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildRows(messages), [messages])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateRowHeight(rows[index]),
    getItemKey: (index) => `${chatId}:${rows[index].key}`,
    initialOffset: () => estimateEndOffset(rows),
    initialRect: { width: 0, height: window.innerHeight },
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: SCROLL_END_THRESHOLD,
    paddingStart: PADDING_BLOCK,
    paddingEnd: PADDING_BLOCK,
    gap: ROW_GAP,
    overscan: OVERSCAN,
    useFlushSync: false,
  })

  useLayoutEffect(() => {
    virtualizer.scrollToEnd()
  }, [virtualizer])

  const totalSize = virtualizer.getTotalSize()
  const shift = Math.max(0, (virtualizer.scrollRect?.height ?? 0) - totalSize)

  return (
    <div ref={parentRef} className={styles.messages}>
      <div className={styles.messagesInner} style={{ height: totalSize + shift }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          const style = { transform: `translateY(${item.start + shift}px)` }

          if (row.separator) {
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className={styles.daySeparator}
                style={style}
              >
                <span className={styles.daySeparatorLabel}>{row.separator}</span>
              </div>
            )
          }

          if (!row.message) return null

          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              data-testid="message"
              data-direction={row.incoming ? 'in' : 'out'}
              className={clsx(
                styles.bubbleRow,
                row.incoming ? styles.bubbleRowIn : styles.bubbleRowOut,
              )}
              style={style}
            >
              <Bubble message={row.message} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The rows mount per chat and only once there are messages, so every chat opens with a fresh
// virtualizer whose first range is already the end of the conversation.
export const MessageList = ({ messages, chat, loading = false }: MessageListProps) =>
  messages.length === 0 ? (
    <div className={clsx(styles.messages, styles.messagesEmpty)}>
      <EmptyState chat={chat} loading={loading} />
    </div>
  ) : (
    <MessageRows key={chat.chatId} chatId={chat.chatId} messages={messages} />
  )

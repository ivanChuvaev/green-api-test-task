import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Chat } from '../api/types'
import { formatChatListTime, plural } from '../utils/format'
import { searchChats } from '../utils/search'
import controls from './Controls.module.scss'
import shell from './Shell.module.scss'
import { Icon } from './Icon'
import { ChatAvatar } from './ChatAvatar'
import { AccountSkeleton } from './AccountSkeleton'
import { ChatItemSkeleton } from './ChatItemSkeleton'
import { MessageStatus } from './MessageStatus'
import styles from './ChatList.module.scss'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  onSelect: (chatId: string) => void
  onNewChat: () => void
  accountTitle: string
  accountPhone: string
  accountAvatarUrl: string
  accountSeed?: string
  onLogout: () => void
  loading?: boolean
  accountLoading?: boolean
  footer?: ReactNode
}

const CHAT_ITEM_HEIGHT = 68
const OVERSCAN = 8
const SKELETON_MIN_ROWS = 4

const ChatItem = memo(
  ({ chat, active, onSelect }: { chat: Chat; active: boolean; onSelect: (id: string) => void }) => (
    <button
      type="button"
      className={clsx(styles.chatItem, active && styles.chatItemActive)}
      data-active={active}
      aria-current={active}
      onClick={() => onSelect(chat.chatId)}
    >
      <ChatAvatar seed={chat.chatId} title={chat.title} src={chat.avatar} size={48} />
      <span className={styles.chatItemBody}>
        <span className={styles.chatItemRow}>
          <span className={styles.chatItemTitle}>{chat.title}</span>
          <span className={styles.chatItemTime}>{formatChatListTime(chat.lastActivity)}</span>
        </span>
        <span className={styles.chatItemRow}>
          <span className={styles.chatItemPreview}>{chat.lastMessage || 'Нет сообщений'}</span>
          {chat.lastStatus ? <MessageStatus status={chat.lastStatus} size={14} /> : null}
          {chat.unread > 0 ? (
            <span className={styles.chatItemUnread}>{chat.unread > 99 ? '99+' : chat.unread}</span>
          ) : null}
        </span>
      </span>
    </button>
  ),
)

export const ChatList = ({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  accountTitle,
  accountPhone,
  accountAvatarUrl,
  accountSeed,
  onLogout,
  loading = false,
  accountLoading = false,
  footer,
}: ChatListProps) => {
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const matches = useMemo(() => searchChats(chats, query), [chats, query])

  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => CHAT_ITEM_HEIGHT,
    getItemKey: (index) => matches[index].chatId,
    overscan: OVERSCAN,
    useFlushSync: false,
  })

  useEffect(() => {
    virtualizer.scrollToOffset(0)
  }, [query, virtualizer])

  const clearQuery = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  const showSkeleton = loading && chats.length === 0

  // The virtualizer only re-renders when its range changes, and an empty list has none.
  const [scrollHeight, setScrollHeight] = useState(0)

  useEffect(() => {
    const box = listRef.current
    if (!showSkeleton || !box) return

    const observer = new ResizeObserver(([entry]) => setScrollHeight(entry.contentRect.height))
    observer.observe(box)

    return () => observer.disconnect()
  }, [showSkeleton])

  const skeletonRows = Math.max(SKELETON_MIN_ROWS, Math.floor(scrollHeight / CHAT_ITEM_HEIGHT))

  const listContent = showSkeleton ? (
    <div role="status" aria-busy="true" aria-label="Загружаем диалоги">
      {Array.from({ length: skeletonRows }, (_, index) => (
        <ChatItemSkeleton key={index} />
      ))}
    </div>
  ) : chats.length === 0 ? (
    <div className={styles.chatListEmpty}>
      <p>Здесь появятся ваши диалоги</p>
      <button type="button" className={controls.linkButton} onClick={onNewChat}>
        Начать новый чат
      </button>
    </div>
  ) : matches.length === 0 ? (
    <div className={styles.chatListEmpty} role="status">
      <p>Ничего не найдено</p>
      <p>Попробуйте другое имя или номер</p>
    </div>
  ) : (
    <div className={styles.chatListItems} style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const chat = matches[item.index]

        return (
          <div
            key={item.key}
            data-index={item.index}
            className={styles.chatItemSlot}
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {chat.profileLoading ? (
              <ChatItemSkeleton />
            ) : (
              <ChatItem chat={chat} active={chat.chatId === activeChatId} onSelect={onSelect} />
            )}
          </div>
        )
      })}
    </div>
  )

  const chatCount = showSkeleton
    ? 'Загружаем диалоги…'
    : searching
      ? `Найдено ${matches.length} из ${chats.length}`
      : chats.length > 0
        ? `${chats.length} ${plural(chats.length, ['чат', 'чата', 'чатов'])}`
        : 'Нет активных чатов'

  return (
    <aside className={clsx(shell.pane, styles.chatList)} data-pane="chatList">
      <div className={styles.chatListHeader}>
        {accountLoading ? (
          <AccountSkeleton />
        ) : (
          <div className={styles.chatListAccount}>
            <ChatAvatar
              seed={accountSeed || accountTitle}
              title={accountTitle}
              src={accountAvatarUrl}
              size={48}
            />
            <div className={styles.chatListIdentity}>
              <span className={styles.chatListName}>{accountTitle}</span>
              <span className={styles.chatListPhone}>{accountPhone}</span>
            </div>
          </div>
        )}
        <button type="button" className={controls.iconButton} onClick={onNewChat} title="Новый чат">
          <Icon name="plus" size={22} />
        </button>
        <button
          type="button"
          className={controls.iconButton}
          onClick={onLogout}
          title="Отключиться"
        >
          <Icon name="logout" size={20} />
        </button>
      </div>

      <div className={styles.chatListSearch}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          className={styles.chatListInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск чатов"
          aria-label="Поиск чатов"
          autoComplete="off"
          spellCheck={false}
        />
        {searching ? (
          <button
            type="button"
            className={styles.chatListClear}
            onClick={clearQuery}
            title="Очистить поиск"
          >
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </div>

      <div className={styles.chatListScroll} ref={listRef}>
        {listContent}
      </div>

      <div className={styles.chatListFooter}>{footer ?? chatCount}</div>
    </aside>
  )
}

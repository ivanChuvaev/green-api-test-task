import clsx from 'clsx'
import type { Chat } from '../api/types'
import { formatPhone } from '../utils/format'
import { ChatAvatar } from './ChatAvatar'
import shell from './Shell.module.scss'
import styles from './ChatProfile.module.scss'

interface ChatProfileProps {
  chat: Chat
  embedded?: boolean
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.chatProfileRow}>
    <span className={styles.chatProfileLabel}>{label}</span>
    <span className={styles.chatProfileValue} title={value}>
      {value}
    </span>
  </div>
)

export const ChatProfile = ({ chat, embedded = false }: ChatProfileProps) => (
  <aside
    className={clsx(
      !embedded && shell.pane,
      styles.chatProfile,
      embedded && styles.chatProfileEmbedded,
    )}
    data-pane={embedded ? undefined : 'chatProfile'}
  >
    <div className={styles.chatProfileBlock}>
      <div className={styles.chatProfileAvatar}>
        <ChatAvatar seed={chat.chatId} title={chat.title} src={chat.avatar} size={96} />
      </div>
      <h3 className={styles.chatProfileName}>{chat.title}</h3>
    </div>

    <div className={styles.chatProfileSection}>
      <h4 className={styles.chatProfileHeading}>Контакт</h4>
      <Row label="Имя" value={chat.title || '—'} />
      <Row label="Телефон" value={chat.phone ? formatPhone(chat.phone) : '—'} />
      <Row label="Chat ID" value={chat.chatId || '—'} />
    </div>
  </aside>
)

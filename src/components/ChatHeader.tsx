import clsx from 'clsx'
import type { Chat } from '../api/types'
import type { ConnectionStatus } from '../hooks/useMessenger'
import { formatPhone } from '../utils/format'
import { ChatAvatar } from './ChatAvatar'
import controls from './Controls.module.scss'
import { Icon } from './Icon'
import styles from './ChatHeader.module.scss'

interface ChatHeaderProps {
  chat: Chat
  connection: ConnectionStatus
  onBack?: () => void
  onOpenProfile?: () => void
}

type ConnectionProblem = Exclude<ConnectionStatus, 'online'>

const problemLabels: Record<ConnectionProblem, string> = {
  connecting: 'Подключение…',
  error: 'Нет связи с GREEN-API',
  unauthorized: 'Инстанс не авторизован',
}

const problemModifiers: Record<ConnectionProblem, string | undefined> = {
  connecting: styles.statusConnecting,
  error: styles.statusError,
  unauthorized: styles.statusUnauthorized,
}

export const ChatHeader = ({ chat, connection, onBack, onOpenProfile }: ChatHeaderProps) => {
  const phone = formatPhone(chat.phone)
  const problem = connection === 'online' ? null : connection

  return (
    <header className={styles.chatHeader}>
      {onBack ? (
        <button
          type="button"
          className={clsx(controls.iconButton, styles.chatHeaderBack)}
          onClick={onBack}
          title="К списку чатов"
        >
          <Icon name="chevron" size={22} />
        </button>
      ) : null}

      <button
        type="button"
        className={styles.chatHeaderProfile}
        onClick={onOpenProfile}
        disabled={!onOpenProfile}
        aria-label="Профиль контакта"
      >
        <ChatAvatar seed={chat.chatId} title={chat.title} src={chat.avatar} size={40} />
        <div className={styles.chatHeaderInfo}>
          <span className={styles.chatHeaderTitle}>{chat.title}</span>
          {phone || problem ? (
            <span className={styles.chatHeaderSubtitle}>
              {phone}
              {phone && problem ? ' · ' : null}
              {problem ? (
                <span className={clsx(styles.status, problemModifiers[problem])}>
                  {problemLabels[problem]}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </button>
    </header>
  )
}

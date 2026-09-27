import clsx from 'clsx'
import type { OutgoingStatus } from '../api/types'
import { Icon } from './Icon'
import styles from './MessageStatus.module.scss'

const statusTitles: Record<'sent' | 'delivered' | 'read', string> = {
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
}

interface MessageStatusProps {
  status: OutgoingStatus
  size?: number
}

export const MessageStatus = ({ status, size = 16 }: MessageStatusProps) => {
  if (status === 'failed') {
    return (
      <span
        className={clsx(styles.messageStatus, styles.messageStatusFailed)}
        title="Не отправлено"
      >
        <Icon name="warning" size={size} />
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className={styles.messageStatus} title="Отправляется">
        <Icon name="clock" size={size} />
      </span>
    )
  }

  return (
    <span className={clsx(styles.messageStatus)} title={statusTitles[status]}>
      <Icon name={status === 'sent' ? 'check' : 'checks'} size={size} />
    </span>
  )
}

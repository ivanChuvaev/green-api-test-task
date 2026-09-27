import { Button, Spinner } from '@maxhub/max-ui'
import clsx from 'clsx'
import type { ConnectionStatus } from '../hooks/useMessenger'
import { Icon } from './Icon'
import styles from './ConnectionBanners.module.scss'

interface ConnectionBannersProps {
  connection: ConnectionStatus
  connectionError: string | null
  notificationsEnabled: boolean
  notificationsBusy: boolean
  onEnableNotifications: () => void
  onRetry: () => void
}

export const ConnectionBanners = ({
  connection,
  connectionError,
  notificationsEnabled,
  notificationsBusy,
  onEnableNotifications,
  onRetry,
}: ConnectionBannersProps) => {
  if (connection === 'online' && notificationsEnabled) return null

  if (connection === 'connecting') {
    return (
      <div className={clsx(styles.banner, styles.bannerMuted)} role="status">
        <Spinner size={14} />
        <span className={styles.bannerText}>Подключение…</span>
      </div>
    )
  }

  if (connection === 'error' || connection === 'unauthorized') {
    return (
      <div className={clsx(styles.banner, styles.bannerError)} role="alert">
        <Icon name="warning" size={16} />
        <span className={styles.bannerText}>
          {connectionError ??
            (connection === 'unauthorized'
              ? 'Инстанс не авторизован'
              : 'Ошибка соединения с GREEN-API')}
        </span>
        <Button size="small" variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <div className={clsx(styles.banner, styles.bannerWarning)} role="status">
      <Icon name="warning" size={16} />
      <span className={styles.bannerText}>
        Входящие уведомления выключены — ответы собеседника не придут. Параметр{' '}
        <code>incomingWebhook</code> = «no».
      </span>
      <Button
        size="small"
        variant="primary"
        loading={notificationsBusy}
        onClick={onEnableNotifications}
      >
        Включить
      </Button>
    </div>
  )
}

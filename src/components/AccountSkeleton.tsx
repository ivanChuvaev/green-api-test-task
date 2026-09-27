import styles from './ChatItemSkeleton.module.scss'

export const AccountSkeleton = () => (
  <div
    className={styles.chatItemSkeletonAccount}
    role="status"
    aria-busy="true"
    aria-label="Загружаем аккаунт"
    data-testid="account-skeleton"
  >
    <span className={styles.chatItemSkeletonAccountAvatar} aria-hidden="true" />
    <span className={styles.chatItemSkeletonAccountBody} aria-hidden="true">
      <span className={styles.chatItemSkeletonAccountName} />
      <span className={styles.chatItemSkeletonAccountPhone} />
    </span>
  </div>
)

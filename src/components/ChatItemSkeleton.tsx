import styles from './ChatItemSkeleton.module.scss'

export const ChatItemSkeleton = () => (
  <div className={styles.chatItemSkeleton} aria-hidden="true" data-testid="chat-skeleton">
    <span className={styles.chatItemSkeletonAvatar} />
    <span className={styles.chatItemSkeletonBody}>
      <span className={styles.chatItemSkeletonLine}>
        <span className={styles.chatItemSkeletonName} />
        <span className={styles.chatItemSkeletonTime} />
      </span>
      <span className={styles.chatItemSkeletonPreview} />
    </span>
  </div>
)

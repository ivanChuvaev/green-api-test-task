import type { Credentials } from '../api/types'
import { LoginForm } from './LoginForm'
import styles from './LoginPage.module.scss'

interface LoginPageProps {
  initial: Credentials | null
  onConnect: (credentials: Credentials, remember: boolean) => void
}

export const LoginPage = ({ initial, onConnect }: LoginPageProps) => (
  <div className={styles.page}>
    <div className={styles.pageGlow} aria-hidden="true" />
    <LoginForm initial={initial} onConnect={onConnect} />
  </div>
)

import { Button, Input } from '@maxhub/max-ui'
import { useState, type SubmitEvent } from 'react'
import { accountTargetError, parseAccountTarget } from '../hooks/useMessenger'
import styles from './NewChatForm.module.scss'

interface NewChatFormProps {
  onFind: (target: string) => Promise<void>
  onCancel: () => void
}

const MAX_TARGET_LENGTH = 33

export const NewChatForm = ({ onFind, onCancel }: NewChatFormProps) => {
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!parseAccountTarget(target)) {
      setError(accountTargetError(target))
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onFind(target.trim())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось найти аккаунт')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.newChatForm} onSubmit={submit}>
      <Input
        value={target}
        onChange={(event) =>
          setTarget(
            event.target.value.replace(/[^\d@_a-zA-Z+\s()-]/g, '').slice(0, MAX_TARGET_LENGTH),
          )
        }
        aria-label="Номер телефона или имя пользователя получателя"
        placeholder="Телефон или имя пользователя"
        autoFocus
      />

      {error ? (
        <div className={styles.newChatFormError} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.newChatFormActions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          Поиск
        </Button>
      </div>
    </form>
  )
}

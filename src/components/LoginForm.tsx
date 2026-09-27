import { Button, Input } from '@maxhub/max-ui'
import { useState } from 'react'
import { describeInstanceState, getAccountSettings, getStateInstance } from '../api/greenApi'
import type { Credentials } from '../api/types'
import { Icon } from './Icon'
import styles from './LoginForm.module.scss'

interface LoginFormProps {
  initial: Credentials | null
  onConnect: (credentials: Credentials, remember: boolean) => void
}

export const LoginForm = ({ initial, onConnect }: LoginFormProps) => {
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? '')
  const [idInstance, setIdInstance] = useState(initial?.idInstance ?? '')
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance ?? '')
  const [remember, setRemember] = useState(Boolean(initial))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setError(null)

    const credentials: Credentials = {
      apiUrl: apiUrl.trim(),
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    }

    if (!credentials.apiUrl) {
      setError('Укажите apiUrl')
      return
    }

    if (!/^\d+$/.test(credentials.idInstance)) {
      setError('idInstance должен содержать только цифры')
      return
    }

    if (!credentials.apiTokenInstance) {
      setError('Укажите apiTokenInstance')
      return
    }

    setLoading(true)
    try {
      const [state, account] = await Promise.all([
        getStateInstance(credentials),
        getAccountSettings(credentials),
      ])

      if (state.stateInstance !== 'authorized') {
        throw new Error(describeInstanceState(state.stateInstance))
      }

      if (!account.phone) {
        throw new Error('Инстанс не привязан к аккаунту мессенджера')
      }

      onConnect(credentials, remember)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось подключиться к GREEN-API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formLogo} aria-hidden="true">
        <Icon name="chat" size={28} />
      </div>
      <h1 className={styles.formTitle}>Мессенджер</h1>
      <p className={styles.formSubtitle}>
        Подключение к GREEN-API. Введите параметры инстанса из личного кабинета.
      </p>

      <label className={styles.formField}>
        <span className={styles.formLabel}>apiUrl</span>
        <Input
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value.trim())}
          placeholder="https://1234.api.green-api.com"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className={styles.formField}>
        <span className={styles.formLabel}>idInstance</span>
        <Input
          value={idInstance}
          onChange={(event) => setIdInstance(event.target.value.replace(/\D/g, ''))}
          placeholder="000000000000"
          inputMode="numeric"
          autoComplete="off"
        />
      </label>

      <label className={styles.formField}>
        <span className={styles.formLabel}>apiTokenInstance</span>
        <Input
          value={apiTokenInstance}
          onChange={(event) => setApiTokenInstance(event.target.value.trim())}
          placeholder="****************************************************"
          type="password"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className={styles.formRemember}>
        <input
          className={styles.formCheckbox}
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>Запомнить на этом устройстве</span>
      </label>

      {error ? (
        <div className={styles.formError} role="alert">
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="large" stretched loading={loading}>
        Подключиться
      </Button>
    </form>
  )
}

import clsx from 'clsx'
import { useRef, useState } from 'react'
import { MAX_MESSAGE_LENGTH } from '../api/greenApi'
import { Icon } from './Icon'
import { MessageEditor, type MessageEditorHandle } from './MessageEditor'
import styles from './Composer.module.scss'

const PLACEHOLDER = 'Сообщение'

interface ComposerProps {
  onSend: (text: string) => Promise<void>
}

export const Composer = ({ onSend }: ComposerProps) => {
  const [value, setValue] = useState('')
  // Enter can follow a keystroke before React renders it, so submit reads the ref.
  const valueRef = useRef('')
  const editorRef = useRef<MessageEditorHandle>(null)

  const change = (next: string) => {
    valueRef.current = next
    setValue(next)
  }

  const canSendText = (raw: string) => raw.trim().length > 0 && raw.length <= MAX_MESSAGE_LENGTH
  const remaining = MAX_MESSAGE_LENGTH - value.length

  const submit = () => {
    const raw = valueRef.current
    if (!canSendText(raw)) return
    const text = raw.trim()
    editorRef.current?.clear()
    onSend(text).catch(() => editorRef.current?.restore(text))
  }

  return (
    <div className={styles.composer}>
      <div className={styles.composerField}>
        {value ? null : (
          <span className={styles.composerPlaceholder} aria-hidden>
            {PLACEHOLDER}
          </span>
        )}
        <MessageEditor
          ref={editorRef}
          placeholder={PLACEHOLDER}
          onChange={change}
          onSubmit={submit}
        />
      </div>
      {remaining < 200 ? (
        <span
          className={clsx(styles.composerCounter, remaining < 0 && styles.composerCounterOver)}
          title={`Не больше ${MAX_MESSAGE_LENGTH} символов`}
        >
          {remaining}
        </span>
      ) : null}
      <button
        type="button"
        className={styles.composerSend}
        onClick={submit}
        disabled={!canSendText(value)}
        title="Отправить (Enter)"
      >
        <Icon name="send" size={24} />
      </button>
    </div>
  )
}

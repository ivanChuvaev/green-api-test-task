import { useEffect, useRef, useState, type ReactNode } from 'react'
import controls from './Controls.module.scss'
import { Icon } from './Icon'
import styles from './Modal.module.scss'

interface ModalProps {
  title: string
  label?: string
  onClose: () => void
  children: ReactNode
}

export const Modal = ({ title, label, onClose, children }: ModalProps) => {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Read during render: by the time an effect runs, `autoFocus` has moved the focus.
  const [previous] = useState(() => document.activeElement)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [previous])

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-label={label ?? title}>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            type="button"
            className={controls.iconButton}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

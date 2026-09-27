import { Modal } from './Modal'
import { NewChatForm } from './NewChatForm'

interface NewChatModalProps {
  onClose: () => void
  onFind: (target: string) => Promise<void>
}

export const NewChatModal = ({ onClose, onFind }: NewChatModalProps) => (
  <Modal title="Новый чат" onClose={onClose}>
    <NewChatForm onFind={onFind} onCancel={onClose} />
  </Modal>
)

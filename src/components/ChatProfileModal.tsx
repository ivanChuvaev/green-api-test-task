import type { Chat } from '../api/types'
import { ChatProfile } from './ChatProfile'
import { Modal } from './Modal'

interface ChatProfileModalProps {
  chat: Chat
  onClose: () => void
}

export const ChatProfileModal = ({ chat, onClose }: ChatProfileModalProps) => (
  <Modal title="Профиль" label="Профиль контакта" onClose={onClose}>
    <ChatProfile chat={chat} embedded />
  </Modal>
)

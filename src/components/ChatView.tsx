import clsx from 'clsx'
import type { Chat, ChatMessage } from '../api/types'
import type { ConnectionStatus } from '../hooks/useMessenger'
import { ChatHeader } from './ChatHeader'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import shell from './Shell.module.scss'
import styles from './ChatView.module.scss'

interface ChatViewProps {
  chat: Chat | null
  messages: ChatMessage[]
  loading: boolean
  connection: ConnectionStatus
  onBack: () => void
  onOpenProfile?: () => void
  onSend: (text: string) => Promise<void>
}

export const ChatView = ({
  chat,
  messages,
  loading,
  connection,
  onBack,
  onOpenProfile,
  onSend,
}: ChatViewProps) => (
  <main
    className={clsx(shell.pane, styles.chatView, !chat && styles.chatViewEmpty)}
    data-pane="chatView"
  >
    {chat ? (
      <>
        <ChatHeader
          chat={chat}
          connection={connection}
          onBack={onBack}
          onOpenProfile={onOpenProfile}
        />

        <MessageList messages={messages} chat={chat} loading={loading} />

        <Composer key={chat.chatId} onSend={onSend} />
      </>
    ) : (
      <p className={styles.chatViewHint}>Выберите чат или начните новый</p>
    )}
  </main>
)

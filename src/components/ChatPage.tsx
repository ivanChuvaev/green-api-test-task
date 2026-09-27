import { useEffect, useState, useSyncExternalStore } from 'react'
import clsx from 'clsx'
import { toast } from 'react-toastify'
import type { Credentials } from '../api/types'
import { useMessenger } from '../hooks/useMessenger'
import { describeError, toastDefaults } from '../lib/toast'
import { formatPhone } from '../utils/format'
import { ChatList } from './ChatList'
import { ChatProfile } from './ChatProfile'
import { ChatView } from './ChatView'
import { ConnectionBanners } from './ConnectionBanners'
import { ChatProfileModal } from './ChatProfileModal'
import { NewChatModal } from './NewChatModal'
import shell from './Shell.module.scss'

const APP_TITLE = 'Мессенджер'

const PROFILE_PANE_QUERY = '(min-width: 1181px)'

const subscribeToProfilePane = (onChange: () => void) => {
  const query = window.matchMedia(PROFILE_PANE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const isProfilePaneShown = () => window.matchMedia(PROFILE_PANE_QUERY).matches

interface ChatPageProps {
  credentials: Credentials
  onLogout: () => void
}

export const ChatPage = ({ credentials, onLogout }: ChatPageProps) => {
  const messenger = useMessenger(credentials)
  const [modalOpen, setModalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profilePaneShown = useSyncExternalStore(subscribeToProfilePane, isProfilePaneShown)
  const profileDialogOpen = profileOpen && !profilePaneShown
  if (profileOpen && profilePaneShown) setProfileOpen(false)

  const currentUser = messenger.currentUser
  const accountName = currentUser?.name || currentUser?.username || ''
  const accountPhone = formatPhone(currentUser?.phone ?? '')
  const accountTitle = accountName || accountPhone
  const accountSubtitle = accountName ? accountPhone : ''
  const accountAvatarUrl = currentUser?.avatar ?? ''

  const activeChat = messenger.activeChat

  const { activeChatId, selectChat } = messenger

  useEffect(() => {
    if (!activeChatId || modalOpen || profileDialogOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      selectChat('')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeChatId, selectChat, modalOpen, profileDialogOpen])

  const unread = messenger.chats.reduce((total, chat) => total + chat.unread, 0)

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = APP_TITLE
    }
  }, [unread])

  const send = async (text: string) => {
    if (!messenger.activeChatId) return
    try {
      await messenger.send(messenger.activeChatId, text)
    } catch (error) {
      toast.error(describeError(error, 'Сообщение не отправлено'), toastDefaults)
      throw error
    }
  }

  const enableNotifications = async () => {
    try {
      await messenger.enableNotifications()
      toast.success('Входящие уведомления включены, ответы уже принимаются', toastDefaults)
    } catch (error) {
      toast.error(describeError(error, 'Не удалось включить уведомления'), toastDefaults)
    }
  }

  const findChat = async (target: string) => {
    await messenger.findChat(target)
    setModalOpen(false)
  }

  return (
    <div className={clsx(shell.shell, messenger.activeChatId && shell.shellChatOpen)}>
      <ChatList
        chats={messenger.chats}
        activeChatId={messenger.activeChatId}
        onSelect={messenger.selectChat}
        onNewChat={() => setModalOpen(true)}
        accountTitle={accountTitle}
        accountPhone={accountSubtitle}
        accountAvatarUrl={accountAvatarUrl}
        accountSeed={currentUser?.chatId ?? ''}
        onLogout={onLogout}
        loading={messenger.dialogsLoading}
        accountLoading={
          (!currentUser || (!currentUser.name && !messenger.ownNameSettled)) &&
          messenger.connection !== 'error' &&
          messenger.connection !== 'unauthorized'
        }
        footer={
          messenger.needsAttention ? (
            <ConnectionBanners
              connection={messenger.connection}
              connectionError={messenger.connectionError}
              notificationsEnabled={messenger.notificationsEnabled}
              notificationsBusy={messenger.notificationsBusy}
              onEnableNotifications={() => void enableNotifications()}
              onRetry={() => void messenger.refreshAccount()}
            />
          ) : undefined
        }
      />

      <ChatView
        chat={activeChat}
        messages={messenger.messages}
        loading={messenger.historyLoading}
        connection={messenger.connection}
        onBack={() => messenger.selectChat('')}
        onOpenProfile={profilePaneShown ? undefined : () => setProfileOpen(true)}
        onSend={send}
      />

      {activeChat ? <ChatProfile chat={activeChat} /> : null}

      {activeChat && profileDialogOpen ? (
        <ChatProfileModal chat={activeChat} onClose={() => setProfileOpen(false)} />
      ) : null}

      {modalOpen ? <NewChatModal onClose={() => setModalOpen(false)} onFind={findChat} /> : null}
    </div>
  )
}

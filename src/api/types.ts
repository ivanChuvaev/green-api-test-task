export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type InstanceState =
  'authorized' | 'notAuthorized' | 'starting' | 'blocked' | 'sleepMode' | 'yellowCard'

export interface AccountSettings {
  phone: string
  chatId: string
  avatar: string
  username: string
  stateInstance: InstanceState
}

export interface InstanceSettings {
  webhookUrl: string
  webhookUrlToken: string
  incomingWebhook: string
  outgoingWebhook: string
  outgoingAPIMessageWebhook: string
  stateWebhook: string
  markIncomingMessagesReaded: string
}

export type AccountTarget = { phoneNumber: string } | { username: string }

export interface CheckAccountResult {
  exist: boolean
  chatId: string
  username: string
  phoneNumber: number
  fromCache: boolean
}

export interface ContactInfo {
  avatar: string
  name: string
  contactName?: string
  chatId: string
  chatType: string
  username: string
  phoneNumber?: number
}

export interface CurrentUser {
  name: string
  username: string
  phone: string
  avatar: string
  chatId: string
}

export interface InstanceData {
  idInstance: number
  wid: string
  typeInstance: string
}

export interface ChatListItem {
  chatId: string
  name: string
  type: string
  phoneNumber: number
  username: string
}

export interface ChatHistoryMessage {
  type: 'incoming' | 'outgoing'
  idMessage: string
  timestamp: number
  typeMessage: string
  chatId: string
  chatType: string
  textMessage?: string
  extendedTextMessage?: { text?: string }
  caption?: string
  statusMessage?: string
  isDeleted?: boolean
  senderId?: string
  senderName?: string
  senderContactName?: string
}

export type JournalMessage = ChatHistoryMessage

export interface SenderData {
  chatId: string
  chatName: string
  chatType: string
  sender: string
  senderName: string
  senderContactName: string
  senderPhoneNumber: number
}

export interface MessageData {
  typeMessage?: string
  textMessageData?: {
    textMessage?: string
    [key: string]: unknown
  }
  extendedTextMessageData?: {
    text?: string
    [key: string]: unknown
  }
  fileMessageData?: {
    caption?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type OutgoingStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface NotificationBody {
  typeWebhook: string
  instanceData: InstanceData
  timestamp: number
  idMessage: string
  senderData?: SenderData
  messageData?: MessageData
  chatId?: string
  status?: string
  description?: string
  [key: string]: unknown
}

export interface Notification {
  receiptId: number
  body: NotificationBody
}

export interface ChatMessage {
  id: string
  localId?: string
  chatId: string
  text: string
  attachment?: string
  direction: 'in' | 'out'
  timestamp: number
  status: OutgoingStatus
}

export interface Chat {
  chatId: string
  title: string
  phone: string
  avatar: string
  unread: number
  lastActivity: number
  lastMessage: string
  lastStatus: OutgoingStatus | null
  profileLoading?: boolean
}

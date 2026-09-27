import type { AccountSettings, ContactInfo, Credentials, CurrentUser } from '../api/types'

export const TEST_API_URL = 'https://1234.api.green-api.com'
export const TEST_ID_INSTANCE = '1234567890'
export const TEST_AVATAR_URL = `${TEST_API_URL}/download/1234/me.jpg`

export const credentials: Credentials = {
  apiUrl: TEST_API_URL,
  idInstance: TEST_ID_INSTANCE,
  apiTokenInstance: 'test-token',
}

export const contactName = 'Тестовый Контакт'
export const contactUsername = '@testcontact'
export const contactPhone = '79007654321'

export const account: AccountSettings = {
  phone: '79001234567',
  chatId: '70001234567',
  avatar: '',
  username: '',
  stateInstance: 'authorized',
}

export const contact: ContactInfo = {
  avatar: TEST_AVATAR_URL,
  name: contactName,
  chatId: '70007654321',
  chatType: 'user',
  username: contactUsername,
}

export const currentUser: CurrentUser = {
  name: '',
  username: '',
  phone: account.phone,
  avatar: account.avatar,
  chatId: account.chatId,
}

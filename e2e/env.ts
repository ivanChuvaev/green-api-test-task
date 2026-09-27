import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const envPath = resolve(fileURLToPath(new URL('..', import.meta.url)), '.env')

if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath)
}

export interface InstanceCredentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

const read = (name: string) => process.env[name]?.trim() ?? ''

export const credentials: InstanceCredentials = {
  apiUrl: read('E2E_GREEN_API_URL'),
  idInstance: read('E2E_GREEN_API_ID_INSTANCE'),
  apiTokenInstance: read('E2E_GREEN_API_TOKEN'),
}

export const recipientPhone = read('E2E_RECIPIENT_PHONE')

export const REQUEST_GAP_MS = 1_200

export const isConfigured =
  Boolean(credentials.apiUrl) &&
  /^\d+$/.test(credentials.idInstance) &&
  Boolean(credentials.apiTokenInstance) &&
  /^\d{10,15}$/.test(recipientPhone)

export const missingVariables = [
  ['E2E_GREEN_API_URL', credentials.apiUrl],
  ['E2E_GREEN_API_ID_INSTANCE', credentials.idInstance],
  ['E2E_GREEN_API_TOKEN', credentials.apiTokenInstance],
  ['E2E_RECIPIENT_PHONE', recipientPhone],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

import { useCallback, useState } from 'react'
import type { Credentials } from '../api/types'

const STORAGE_KEY = 'messenger.credentials'

export interface SessionState {
  credentials: Credentials | null
  restore: () => Credentials | null
  save: (credentials: Credentials, remember: boolean) => void
  clear: () => void
}

const readStored = (): Credentials | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Credentials
    if (!parsed?.apiUrl || !parsed?.idInstance || !parsed?.apiTokenInstance) return null
    return parsed
  } catch {
    return null
  }
}

export const useSession = (): SessionState => {
  const [credentials, setCredentials] = useState<Credentials | null>(readStored)

  const save = useCallback((next: Credentials, remember: boolean) => {
    setCredentials(next)
    if (remember) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const clear = useCallback(() => {
    setCredentials(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { credentials, restore: readStored, save, clear }
}

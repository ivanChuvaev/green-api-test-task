import type { ToastOptions, ToastPosition } from 'react-toastify'

export const TOAST_POSITION: ToastPosition = 'bottom-center'
export const TOAST_AUTO_CLOSE_MS = 4000
export const TOAST_LIMIT = 3

export const toastDefaults: ToastOptions = {
  position: TOAST_POSITION,
  autoClose: TOAST_AUTO_CLOSE_MS,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  draggable: true,
  role: 'status',
}

export const describeError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

import type { ComponentType, SVGProps } from 'react'
import chat from '../assets/icons/chat.svg?react'
import check from '../assets/icons/check.svg?react'
import checks from '../assets/icons/checks.svg?react'
import chevron from '../assets/icons/chevron.svg?react'
import clock from '../assets/icons/clock.svg?react'
import close from '../assets/icons/close.svg?react'
import logout from '../assets/icons/logout.svg?react'
import plus from '../assets/icons/plus.svg?react'
import search from '../assets/icons/search.svg?react'
import send from '../assets/icons/send.svg?react'
import warning from '../assets/icons/warning.svg?react'

export type IconName =
  | 'search'
  | 'send'
  | 'plus'
  | 'check'
  | 'checks'
  | 'clock'
  | 'warning'
  | 'logout'
  | 'chat'
  | 'close'
  | 'chevron'

const icons: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  search,
  send,
  plus,
  check,
  checks,
  clock,
  warning,
  logout,
  chat,
  close,
  chevron,
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export const Icon = ({ name, size = 20, className }: IconProps) => {
  const Glyph = icons[name]
  return <Glyph width={size} height={size} className={className} aria-hidden focusable="false" />
}

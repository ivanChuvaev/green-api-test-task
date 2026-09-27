import { Avatar } from '@maxhub/max-ui'
import { initials } from '../utils/format'

interface ChatAvatarProps {
  seed: string
  title: string
  src?: string
  size: 40 | 48 | 96
}

const gradients = ['red', 'orange', 'green', 'blue', 'purple'] as const

const gradientFor = (seed: string) => {
  let hash = 0
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % gradients.length
  return gradients[hash]
}

export const ChatAvatar = ({ seed, title, src, size }: ChatAvatarProps) => (
  <Avatar.Container size={size} form="circle">
    {src ? (
      <Avatar.Image
        src={src}
        alt={title}
        fallback={initials(title)}
        fallbackGradient={gradientFor(seed)}
      />
    ) : (
      <Avatar.Text gradient={gradientFor(seed)}>{initials(title)}</Avatar.Text>
    )}
  </Avatar.Container>
)

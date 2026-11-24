'use client'

import { Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = { active: boolean; onToggle: () => void }

export function BookmarkButton({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? 'إزالة العلامة المرجعية' : 'وضع علامة مرجعية هنا'}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition',
        'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active && 'text-primary',
      )}
    >
      <Bookmark className="size-5" fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

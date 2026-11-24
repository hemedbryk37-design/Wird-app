'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/plan'
import { parseVerses } from '@/lib/progress'
import { BookmarkButton } from './bookmark-button'

export type ReciteMode = 'off' | 'ajuz' | 'all'

const MODES: { value: ReciteMode; label: string }[] = [
  { value: 'off', label: 'عرض كامل' },
  { value: 'ajuz', label: 'إخفاء العجز' },
  { value: 'all', label: 'إخفاء البيت' },
]

type Props = { text: string; firstNumber: number; idPrefix: string; marked: number | null; onMark: (item: number) => void }

export function PoetryView({ text, firstNumber, idPrefix, marked, onMark }: Props) {
  const verses = parseVerses(text)
  const [mode, setMode] = useState<ReciteMode>('off')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const changeMode = (next: ReciteMode) => {
    setMode(next)
    setRevealed(new Set())
  }

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (verses.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">وضع التسميع</span>
        <div role="radiogroup" aria-label="وضع التسميع" className="flex rounded-lg bg-secondary p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => changeMode(m.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                mode === m.value && 'bg-card text-foreground shadow-xs',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode !== 'off' && (
        <p className="text-xs text-muted-foreground">
          {mode === 'ajuz' ? 'سمّع العجز ثم اضغط عليه للتحقق.' : 'سمّع البيت ثم اضغط عليه لإظهاره.'}
        </p>
      )}

      <ol className="flex flex-col divide-y divide-border/70">
        {verses.map((verse, i) => {
          const id = String(i)
          const isRevealed = revealed.has(id)
          const hideSadr = mode === 'all' && !isRevealed
          const hideAjuz = (mode === 'ajuz' || mode === 'all') && !isRevealed
          return (
            <li key={id} id={`${idPrefix}-${i}`} className={cn('flex items-start gap-3 py-3', marked === i && 'rounded-lg bg-accent/40')}>
              <span className="w-6 shrink-0 pt-1 text-center text-xs tabular-nums text-muted-foreground">
                {formatNumber(firstNumber + i)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 font-poetry text-lg leading-loose md:flex-row md:gap-8">
                {mode === 'all' ? (
                  <Hemistich hidden={hideSadr} onToggle={() => toggle(id)} label="البيت" className="md:flex-1">
                    {verse.sadr}
                  </Hemistich>
                ) : (
                  <span className="md:flex-1 md:text-justify">{verse.sadr}</span>
                )}
                {verse.ajuz &&
                  (mode === 'off' ? (
                    <span className="ps-6 md:flex-1 md:ps-0 md:text-justify">{verse.ajuz}</span>
                  ) : (
                    <Hemistich
                      hidden={hideAjuz}
                      onToggle={() => toggle(id)}
                      label="العجز"
                      className="ps-6 md:flex-1 md:ps-0"
                    >
                      {verse.ajuz}
                    </Hemistich>
                  ))}
              </div>
              <BookmarkButton active={marked === i} onToggle={() => onMark(i)} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Hemistich({
  hidden,
  onToggle,
  label,
  className,
  children,
}: {
  hidden: boolean
  onToggle: () => void
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? `إظهار ${label}` : undefined}
      aria-expanded={!hidden}
      className={cn(
        'group relative rounded-md text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      <span className={cn('transition', hidden && 'invisible')} aria-hidden={hidden}>
        {children}
      </span>
      {hidden ? (
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-secondary font-sans text-xs text-primary group-hover:bg-accent">
          <Eye className="size-3.5" aria-hidden />
          اضغط للإظهار
        </span>
      ) : (
        <EyeOff
          className="absolute -end-1 top-1 hidden size-3 text-muted-foreground group-hover:block"
          aria-hidden
        />
      )}
    </button>
  )
}

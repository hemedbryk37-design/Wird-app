'use client'

import { useEffect, useId, useState } from 'react'
import { Bookmark, Check, ChevronDown, Eraser, FileText, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatNumber, formatQuantity, formatShortDate, formatWeekday, type SavedPlan, type ScheduleEntry } from '@/lib/plan'
import { celebrate } from '@/lib/feedback'
import { textKey, type DayProgress } from '@/lib/progress'
import { removeStorageKeys, useLocalStorage } from '@/lib/use-local-storage'
import { formatGregorianShort } from '@/lib/hijri'
import { splitParagraphs, useBookmarks, useResume } from '@/lib/bookmarks'
import { BookmarkButton } from './bookmark-button'
import { PoetryView } from './poetry-view'

type Props = {
  plan: SavedPlan
  entry: ScheduleEntry
  progress: DayProgress
  onToggleDone: () => void
  onPurged: () => void
}

export function DayCard({ plan, entry, progress, onToggleDone, onPurged }: Props) {
  const key = textKey(plan.id, entry.index)
  const [text, setText] = useLocalStorage<string>(key, '')
  const [bookmarks, setBookmarks] = useBookmarks()
  const [resume, setResume] = useResume()
  const resuming = resume?.planId === plan.id && resume.day === entry.index
  const [open, setOpen] = useState(resuming)
  const idPrefix = `bm-${plan.id}-${entry.index}`
  const mark = bookmarks[plan.id]
  const marked = mark?.day === entry.index ? mark.item : null

  const toggleMark = (item: number) =>
    setBookmarks((prev) => {
      const { [plan.id]: current, ...rest } = prev
      if (current?.day === entry.index && current.item === item) return rest
      return { ...rest, [plan.id]: { day: entry.index, item, at: Date.now() } }
    })

  useEffect(() => {
    if (!resuming) return
    const target = resume.item
    const t = setTimeout(() => {
      document.getElementById(`${idPrefix}-${target}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setResume(null)
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const panelId = useId()
  const textareaId = useId()

  const isPoetry = plan.unit === 'verse'
  const hasText = text.trim().length > 0
  const showEditor = !progress.purged && (editing || !hasText)
  const quantity = formatQuantity(entry.amount, plan)

  const purge = () => {
    celebrate()
    removeStorageKeys((k) => k === key)
    setConfirming(false)
    setEditing(false)
    setOpen(false)
    onPurged()
  }

  return (
    <li
      className={cn(
        'rounded-xl border border-border bg-card transition',
        progress.done && 'border-primary/30 bg-primary/[0.03]',
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggleDone}
          disabled={progress.purged}
          aria-pressed={!!progress.done}
          aria-label={`${progress.done ? 'إلغاء إنجاز' : 'تسجيل إنجاز'} اليوم ${formatNumber(entry.index)}`}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-input text-primary-foreground transition',
            'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed',
            progress.done && 'border-primary bg-primary',
          )}
        >
          {progress.done && <Check className="size-4" strokeWidth={3} aria-hidden />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-muted-foreground tabular-nums">{formatNumber(entry.index)}.</span>
              {formatWeekday(entry.date)}
              <span>{formatShortDate(entry.date)}</span>
              <span className="text-xs font-normal text-muted-foreground">({formatGregorianShort(entry.date)} م)</span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{quantity}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {formatNumber(entry.from)} – {formatNumber(entry.to)}
              </span>
              {progress.purged ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  {'✅ أُتقن · حُذف النص'}
                </span>
              ) : (
                hasText && <FileText className="size-3.5 text-primary" aria-label="يحتوي على نص" />
              )}
              {marked !== null && <Bookmark className="size-3.5 text-primary" fill="currentColor" aria-label="فيه علامة مرجعية" />}
            </p>
          </div>
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-border p-3 md:p-4">
          {progress.purged ? (
            <p className="text-sm text-muted-foreground text-pretty">
              أتقنت هذا الورد وحُذف نصه من الذاكرة لتوفير المساحة. يبقى إنجازه محسوبًا في التقدم العام.
            </p>
          ) : showEditor ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={textareaId} className="text-sm font-medium">
                نص الورد
              </label>
              <textarea
                id={textareaId}
                value={text}
                onChange={(e) => {
                  setEditing(true)
                  setText(e.target.value)
                }}
                rows={isPoetry ? 6 : 5}
                dir="rtl"
                placeholder={
                  isPoetry
                    ? 'الصق الأبيات هنا، كل بيت في سطر مع فاصل بين الشطرين مثل ***\nقال محمدٌ هو ابنُ مالكِ *** أحمدُ ربي اللهَ خيرَ مالكِ'
                    : 'الصق أو اكتب نص ورد هذا اليوم'
                }
                className={cn(
                  'w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition',
                  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
                  isPoetry && 'font-poetry text-lg',
                )}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isPoetry
                    ? 'الفواصل المدعومة: *** أو | أو … أو مسافات متعددة. بدون فاصل يُعدّ كل سطرين بيتًا.'
                    : 'يُحفظ النص تلقائيًا أثناء الكتابة.'}
                </p>
                {hasText && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    عرض
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isPoetry ? (
                <PoetryView text={text} firstNumber={entry.from} idPrefix={idPrefix} marked={marked} onMark={toggleMark} />
              ) : (
                <ol className="flex flex-col divide-y divide-border/70">
                  {splitParagraphs(text).map((p, i) => (
                    <li
                      key={i}
                      id={`${idPrefix}-${i}`}
                      className={cn('flex items-start gap-2 py-3', marked === i && 'rounded-lg bg-accent/40')}
                    >
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-loose text-pretty">{p}</p>
                      <BookmarkButton active={marked === i} onToggle={() => toggleMark(i)} />
                    </li>
                  ))}
                </ol>
              )}
              <div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden />
                  تحرير النص
                </Button>
              </div>
            </div>
          )}

          {progress.done && !progress.purged && (
            <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
              {confirming ? (
                <>
                  <p className="text-sm text-pretty">
                    سيُحذف نص هذا اليوم نهائيًا ولا يمكن استرجاعه، مع بقاء علامة الإنجاز. هل أنت متأكد؟
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="destructive" onClick={purge}>
                      نعم، احذف النص
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                      إلغاء
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto justify-start py-2 text-start whitespace-normal"
                  onClick={() => setConfirming(true)}
                >
                  <Eraser aria-hidden />
                  تم الإتقان - حذف المحتوى لتوفير المساحة
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

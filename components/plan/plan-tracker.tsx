'use client'

import { ArrowRight, HardDrive, Share2 } from 'lucide-react'
import { celebrate } from '@/lib/feedback'
import { buildShareText, shareToWhatsApp } from '@/lib/share'
import { Button } from '@/components/ui/button'
import { formatLongDate, formatNumber, formatQuantity, type SavedPlan, planRemaining } from '@/lib/plan'
import { formatBytes, progressKey, textPrefix, type PlanProgress } from '@/lib/progress'
import { useLocalStorage, useStorageBytes } from '@/lib/use-local-storage'
import { DayCard } from './day-card'

const EMPTY_PROGRESS: PlanProgress = {}

type Props = { plan: SavedPlan; onBack: () => void }

export function PlanTracker({ plan, onBack }: Props) {
  const [progress, setProgress] = useLocalStorage<PlanProgress>(progressKey(plan.id), EMPTY_PROGRESS)
  const textBytes = useStorageBytes(textPrefix(plan.id))

  const doneEntries = plan.schedule.filter((e) => progress[e.index]?.done)
  const doneAmount = doneEntries.reduce((sum, e) => sum + e.amount, 0)
  const percent = planRemaining(plan) > 0 ? Math.round((doneAmount / planRemaining(plan)) * 100) : 0
  const purgedCount = plan.schedule.filter((e) => progress[e.index]?.purged).length
  const nextEntry = plan.schedule.find((e) => !progress[e.index]?.done)

  const toggleDone = (index: number) => {
    const day = progress[index] ?? {}
    if (!day.done && !day.purged) celebrate()
    setProgress((prev) => {
      const day = prev[index] ?? {}
      if (day.purged) return prev
      return { ...prev, [index]: { ...day, done: !day.done } }
    })
  }

  const markPurged = (index: number) =>
    setProgress((prev) => ({ ...prev, [index]: { done: true, purged: true } }))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ms-2">
          <ArrowRight aria-hidden />
          العودة إلى الخطط
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => shareToWhatsApp(buildShareText(plan, progress))}
          className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
        >
          <Share2 aria-hidden />
          مشاركة عبر واتساب
        </Button>
      </div>

      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-primary">متابعة الورد</p>
        <h1 className="text-3xl font-bold text-balance">{plan.title || 'خطة بلا عنوان'}</h1>
        <p className="text-sm text-muted-foreground">
          {formatQuantity(planRemaining(plan), plan)} · {formatNumber(plan.schedule.length)} يومًا
          {nextEntry ? ` · الورد التالي: ${formatLongDate(nextEntry.date)}` : ' · اكتملت الخطة'}
        </p>
      </header>

      <section aria-labelledby="progress-heading" className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="progress-heading" className="text-xs opacity-80">
              التقدم العام
            </h2>
            <p className="mt-1 text-xl font-semibold">
              {formatNumber(doneAmount)} من {formatQuantity(planRemaining(plan), plan)}
            </p>
          </div>
          <p className="text-3xl font-bold tabular-nums">{formatNumber(percent)}٪</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={planRemaining(plan)}
          aria-valuenow={doneAmount}
          aria-valuetext={`${percent}٪`}
          aria-labelledby="progress-heading"
          className="h-2.5 overflow-hidden rounded-full bg-primary-foreground/20"
        >
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-90">
          <div className="flex gap-1">
            <dt>الأيام المنجزة:</dt>
            <dd className="font-semibold">
              {formatNumber(doneEntries.length)} / {formatNumber(plan.schedule.length)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>نصوص محذوفة بعد الإتقان:</dt>
            <dd className="font-semibold">{formatNumber(purgedCount)}</dd>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="size-3.5" aria-hidden />
            <dt>مساحة النصوص:</dt>
            <dd className="font-semibold">{formatBytes(textBytes)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="days-heading" className="flex flex-col gap-3">
        <h2 id="days-heading" className="text-lg font-semibold">
          أيام الورد
        </h2>
        <ol className="flex flex-col gap-2.5">
          {plan.schedule.map((entry) => (
            <DayCard
              key={entry.index}
              plan={plan}
              entry={entry}
              progress={progress[entry.index] ?? {}}
              onToggleDone={() => toggleDone(entry.index)}
              onPurged={() => markPurged(entry.index)}
            />
          ))}
        </ol>
      </section>
    </main>
  )
}

'use client'

import { BookOpen, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatLongDate, formatNumber, formatQuantity, type SavedPlan } from '@/lib/plan'
import { progressKey, type PlanProgress } from '@/lib/progress'
import { useLocalStorage } from '@/lib/use-local-storage'

type Props = {
  plans: SavedPlan[]
  editingId: string | null
  onEdit: (plan: SavedPlan) => void
  onDelete: (id: string) => void
  onTrack: (id: string) => void
}

export function SavedPlans({ plans, editingId, onEdit, onDelete, onTrack }: Props) {
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">لم تحفظ أي خطة بعد. ستظهر خططك المحفوظة هنا.</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => (
        <SavedPlanCard
          key={plan.id}
          plan={plan}
          editing={plan.id === editingId}
          onEdit={() => onEdit(plan)}
          onDelete={() => onDelete(plan.id)}
          onTrack={() => onTrack(plan.id)}
        />
      ))}
    </ul>
  )
}

const EMPTY_PROGRESS: PlanProgress = {}

function SavedPlanCard({
  plan,
  editing,
  onEdit,
  onDelete,
  onTrack,
}: {
  plan: SavedPlan
  editing: boolean
  onEdit: () => void
  onDelete: () => void
  onTrack: () => void
}) {
  const [progress] = useLocalStorage<PlanProgress>(progressKey(plan.id), EMPTY_PROGRESS)
  const last = plan.schedule[plan.schedule.length - 1]
  const doneAmount = plan.schedule.reduce((sum, e) => sum + (progress[e.index]?.done ? e.amount : 0), 0)
  const percent = plan.total > 0 ? Math.round((doneAmount / plan.total) * 100) : 0

  return (
    <li
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 data-[editing=true]:border-primary"
      data-editing={editing}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <BookOpen className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{plan.title || 'خطة بلا عنوان'}</h3>
          <p className="text-sm text-muted-foreground">
            {formatQuantity(plan.total, plan)} · {formatNumber(plan.schedule.length)} يومًا ·{' '}
            {plan.mode === 'fixed' ? 'ورد ثابت' : 'أيام محددة'}
          </p>
        </div>
      </div>
      {last && <p className="text-xs text-muted-foreground">الختم: {formatLongDate(last.date)}</p>}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatNumber(percent)}٪ منجز
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onTrack}>
          <ListChecks aria-hidden />
          متابعة
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          تعديل
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`حذف خطة ${plan.title || 'بلا عنوان'}`}
        >
          <Trash2 aria-hidden />
          حذف
        </Button>
      </div>
    </li>
  )
}

import { AlertCircle, CalendarCheck2 } from 'lucide-react'
import {
  formatLongDate,
  formatNumber,
  formatQuantity,
  formatShortDate,
  formatWeekday,
  type PlanDraft,
  type ScheduleResult,
} from '@/lib/plan'

type Props = {
  draft: PlanDraft
  result: ScheduleResult
}

export function SchedulePreview({ draft, result }: Props) {
  if (!result.ok) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input p-8 text-center">
        <CalendarCheck2 className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{result.reason}</p>
      </div>
    )
  }

  const { entries, warning } = result
  const last = entries[entries.length - 1]
  const amounts = entries.map((e) => e.amount)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const perSession = min === max ? formatQuantity(max, draft) : `${formatNumber(min)} – ${formatQuantity(max, draft)}`

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="عدد أيام الورد" value={`${formatNumber(entries.length)} يومًا`} />
        <Stat label="مقدار كل جلسة" value={perSession} />
        <div className="col-span-2 rounded-xl bg-primary p-4 text-primary-foreground">
          <dt className="text-xs opacity-80">تاريخ الختم المتوقع</dt>
          <dd className="mt-1 text-lg font-semibold text-pretty">{formatLongDate(last.date)}</dd>
        </div>
      </dl>

      {warning && (
        <p className="flex items-start gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {warning}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">جدول توزيع الورد</caption>
            <thead className="sticky top-0 bg-secondary text-secondary-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-start font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2.5 text-start font-medium">
                  التاريخ
                </th>
                <th scope="col" className="px-3 py-2.5 text-start font-medium">
                  المقدار
                </th>
                <th scope="col" className="px-3 py-2.5 text-start font-medium">
                  من – إلى
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {entries.map((entry) => (
                <tr key={entry.index}>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatNumber(entry.index)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{formatWeekday(entry.date)}</span>
                    <span className="block text-xs text-muted-foreground">{formatShortDate(entry.date)}</span>
                  </td>
                  <td className="px-3 py-2.5">{formatQuantity(entry.amount, draft)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {formatNumber(entry.from)} – {formatNumber(entry.to)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-semibold">{value}</dd>
    </div>
  )
}

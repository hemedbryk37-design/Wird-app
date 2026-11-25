import { formatLongDate, formatNumber, formatQuantity, formatShortDate, formatWeekday, type SavedPlan, planRemaining } from './plan'
import type { PlanProgress } from './progress'

// Keeps the wa.me link comfortably below URL length limits for long plans.
const MAX_LINES = 30

export function buildShareText(plan: SavedPlan, progress: PlanProgress) {
  const done = plan.schedule.filter((e) => progress[e.index]?.done)
  const doneAmount = done.reduce((sum, e) => sum + e.amount, 0)
  const percent = planRemaining(plan) > 0 ? Math.round((doneAmount / planRemaining(plan)) * 100) : 0
  const last = plan.schedule.at(-1)

  const lines = [
    `*خطة متابعة: ${plan.title || 'خطة بلا عنوان'}*`,
    '',
    `الكمية: ${formatQuantity(planRemaining(plan), plan)}`,
    `الإنجاز: ${formatNumber(doneAmount)} من ${formatQuantity(planRemaining(plan), plan)} (${formatNumber(percent)}٪)`,
    `الأيام المنجزة: ${formatNumber(done.length)} / ${formatNumber(plan.schedule.length)}`,
  ]
  if (last) lines.push(`تاريخ الختم: ${formatLongDate(last.date)}`)

  const pending = plan.schedule.filter((e) => !progress[e.index]?.done)
  const showAll = plan.schedule.length <= MAX_LINES
  const rows = showAll ? plan.schedule : pending.slice(0, MAX_LINES)

  lines.push('', showAll ? '*الجدول:*' : '*الأيام القادمة:*')
  rows.forEach((e) => {
    const mark = progress[e.index]?.done ? '✅' : '◻️'
    lines.push(
      `${mark} ${formatNumber(e.index)}. ${formatWeekday(e.date)} ${formatShortDate(e.date)} — ${formatQuantity(e.amount, plan)} (${formatNumber(e.from)}–${formatNumber(e.to)})`,
    )
  })
  if (!showAll && pending.length > rows.length) {
    lines.push(`… و${formatNumber(pending.length - rows.length)} يومًا آخر`)
  }
  if (rows.length === 0) lines.push('اكتملت الخطة بحمد الله.')

  return lines.join('\n')
}

export function shareToWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

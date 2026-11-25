import type { ToneId } from './tones'
export type UnitKey = 'verse' | 'ayah' | 'hadith' | 'page' | 'chapter' | 'custom'
export type PlanMode = 'fixed' | 'weekdays'

export type PlanDraft = {
  title: string
  total: number
  startPoint?: number
  unit: UnitKey
  customUnit: string
  mode: PlanMode
  daily: number
  weekdays: number[]
  weeks: number
  startDate: string
  reminderTime?: string
  alarmMode?: boolean
  tone?: ToneId
}

export type ScheduleEntry = {
  index: number
  date: string
  amount: number
  from: number
  to: number
}

export type SavedPlan = PlanDraft & {
  id: string
  createdAt: string
  schedule: ScheduleEntry[]
}

type UnitForms = { one: string; single: string; two: string; few: string; many: string }

export const UNITS: Record<Exclude<UnitKey, 'custom'>, UnitForms> = {
  verse: { one: 'بيت', single: 'بيت واحد', two: 'بيتان', few: 'أبيات', many: 'بيتًا' },
  ayah: { one: 'آية', single: 'آية واحدة', two: 'آيتان', few: 'آيات', many: 'آية' },
  hadith: { one: 'حديث', single: 'حديث واحد', two: 'حديثان', few: 'أحاديث', many: 'حديثًا' },
  page: { one: 'صفحة', single: 'صفحة واحدة', two: 'صفحتان', few: 'صفحات', many: 'صفحة' },
  chapter: { one: 'فصل', single: 'فصل واحد', two: 'فصلان', few: 'فصول', many: 'فصلًا' },
}

export const UNIT_OPTIONS: { value: UnitKey; label: string }[] = [
  { value: 'verse', label: 'بيت شعري' },
  { value: 'ayah', label: 'آية' },
  { value: 'hadith', label: 'حديث' },
  { value: 'page', label: 'صفحة' },
  { value: 'chapter', label: 'فصل' },
  { value: 'custom', label: 'وحدة مخصصة' },
]

// JS getDay() values ordered as the Arabic week (Saturday first).
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 6, label: 'السبت', short: 'سبت' },
  { value: 0, label: 'الأحد', short: 'أحد' },
  { value: 1, label: 'الاثنين', short: 'اثنين' },
  { value: 2, label: 'الثلاثاء', short: 'ثلاثاء' },
  { value: 3, label: 'الأربعاء', short: 'أربعاء' },
  { value: 4, label: 'الخميس', short: 'خميس' },
  { value: 5, label: 'الجمعة', short: 'جمعة' },
]

const numberFormat = new Intl.NumberFormat('ar-EG')
const longDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
})
const weekdayName = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long' })

export const formatNumber = (n: number) => numberFormat.format(n)

export function formatQuantity(n: number, draft: Pick<PlanDraft, 'unit' | 'customUnit'>) {
  if (draft.unit === 'custom') {
    const name = draft.customUnit.trim() || 'وحدة'
    return `${formatNumber(n)} ${name}`
  }
  const forms = UNITS[draft.unit]
  if (n === 1) return forms.single
  if (n === 2) return forms.two
  const mod = n % 100
  if (mod >= 3 && mod <= 10) return `${formatNumber(n)} ${forms.few}`
  return `${formatNumber(n)} ${forms.many}`
}

export function unitLabel(draft: Pick<PlanDraft, 'unit' | 'customUnit'>) {
  if (draft.unit === 'custom') return draft.customUnit.trim() || 'وحدة'
  return UNITS[draft.unit].one
}

export function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const formatLongDate = (iso: string) => longDate.format(parseISODate(iso))
export const formatShortDate = (iso: string) => shortDate.format(parseISODate(iso))
export const formatWeekday = (iso: string) => weekdayName.format(parseISODate(iso))

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function createDefaultDraft(): PlanDraft {
  return {
    title: '',
    total: 0,
    startPoint: 1,
    unit: 'verse',
    customUnit: '',
    mode: 'fixed',
    daily: 0,
    weekdays: [6, 1, 3],
    weeks: 4,
    startDate: toISODate(new Date()),
    reminderTime: '',
  }
}

export type ScheduleResult =
  | { ok: true; entries: ScheduleEntry[]; warning?: string }
  | { ok: false; reason: string }

const MAX_ENTRIES = 3650

export function buildSchedule(draft: PlanDraft): ScheduleResult {
  const total = Math.floor(draft.total)
  if (!total || total < 1) return { ok: false, reason: 'أدخل الكمية الإجمالية لبدء الحساب.' }
  if (!draft.startDate) return { ok: false, reason: 'اختر تاريخ البدء.' }
  const first = Math.max(1, Math.floor(draft.startPoint || 1))
  if (first > total) return { ok: false, reason: 'نقطة البداية أكبر من الكمية الإجمالية.' }
  const remaining = total - first + 1
  const start = parseISODate(draft.startDate)

  if (draft.mode === 'fixed') {
    const daily = Math.floor(draft.daily)
    if (!daily || daily < 1) return { ok: false, reason: 'حدّد مقدار الورد اليومي.' }
    const days = Math.ceil(remaining / daily)
    if (days > MAX_ENTRIES) return { ok: false, reason: 'المدة طويلة جدًا، زد مقدار الورد اليومي.' }

    const entries: ScheduleEntry[] = []
    let from = first
    for (let i = 0; i < days; i++) {
      const amount = Math.min(daily, total - from + 1)
      entries.push({ index: i + 1, date: toISODate(addDays(start, i)), amount, from, to: from + amount - 1 })
      from += amount
    }
    return { ok: true, entries }
  }

  if (draft.weekdays.length === 0) return { ok: false, reason: 'اختر يومًا واحدًا على الأقل من أيام الأسبوع.' }
  const weeks = Math.floor(draft.weeks)
  if (!weeks || weeks < 1) return { ok: false, reason: 'حدّد عدد الأسابيع.' }
  if (weeks * 7 > MAX_ENTRIES) return { ok: false, reason: 'عدد الأسابيع كبير جدًا.' }

  const selected = new Set(draft.weekdays)
  const dates: string[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i)
    if (selected.has(d.getDay())) dates.push(toISODate(d))
  }
  if (dates.length === 0) return { ok: false, reason: 'لا توجد أيام مطابقة ضمن المدة المحددة.' }

  const base = Math.floor(remaining / dates.length)
  const remainder = remaining % dates.length
  const entries: ScheduleEntry[] = []
  let from = first
  dates.forEach((date, i) => {
    const amount = base + (i < remainder ? 1 : 0)
    if (amount === 0) return
    entries.push({ index: entries.length + 1, date, amount, from, to: from + amount - 1 })
    from += amount
  })

  const warning =
    remaining < dates.length
      ? `الكمية أقل من عدد الأيام المتاحة (${formatNumber(dates.length)})، لذا وُزّعت على ${formatNumber(entries.length)} يومًا فقط.`
      : remainder > 0
        ? `لا تنقسم الكمية بالتساوي تمامًا، فزِيد ${formatNumber(remainder)} على الأيام الأولى بمقدار واحد.`
        : undefined

  return { ok: true, entries, warning }
}

export const planRemaining = (plan: Pick<PlanDraft, 'total' | 'startPoint'>) =>
  Math.max(0, plan.total - Math.max(1, Math.floor(plan.startPoint || 1)) + 1)

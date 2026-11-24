'use client'

import { CalendarDays, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UNIT_OPTIONS, WEEKDAYS, formatLongDate, unitLabel, type PlanDraft, type PlanMode, type UnitKey } from '@/lib/plan'
import { ReminderField } from './reminder-field'

type Props = {
  draft: PlanDraft
  onChange: (patch: Partial<PlanDraft>) => void
  renderImport?: (fieldClass: string) => React.ReactNode
  totalLocked?: boolean
}

export const fieldClass =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 placeholder:text-muted-foreground'

const toNumber = (value: string) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function PlanForm({ draft, onChange, renderImport, totalLocked }: Props) {
  const unit = unitLabel(draft)

  const toggleWeekday = (day: number) => {
    const next = draft.weekdays.includes(day)
      ? draft.weekdays.filter((d) => d !== day)
      : [...draft.weekdays, day]
    onChange({ weekdays: next })
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-sm font-semibold text-muted-foreground">المادة المراد متابعتها</legend>

        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-sm font-medium">
            اسم الكتاب أو المتن
          </label>
          <input
            id="title"
            type="text"
            className={fieldClass}
            placeholder="مثال: ألفية ابن مالك"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="total" className="text-sm font-medium">
              الكمية الإجمالية
            </label>
            <input
              id="total"
              type="number"
              inputMode="numeric"
              min={1}
              className={cn(fieldClass, totalLocked && 'bg-muted text-muted-foreground')}
              placeholder="1000"
              value={draft.total || ''}
              readOnly={totalLocked}
              aria-readonly={totalLocked}
              title={totalLocked ? 'تُحسب من الملف المرفوع' : undefined}
              onChange={(e) => onChange({ total: toNumber(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="unit" className="text-sm font-medium">
              نوع الوحدة
            </label>
            <select
              id="unit"
              className={cn(fieldClass, 'cursor-pointer')}
              value={draft.unit}
              onChange={(e) => onChange({ unit: e.target.value as UnitKey })}
            >
              {UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {draft.unit === 'custom' && (
          <div className="flex flex-col gap-2">
            <label htmlFor="customUnit" className="text-sm font-medium">
              اسم الوحدة المخصصة
            </label>
            <input
              id="customUnit"
              type="text"
              className={fieldClass}
              placeholder="مثال: حديث، باب، مسألة"
              value={draft.customUnit}
              onChange={(e) => onChange({ customUnit: e.target.value })}
            />
          </div>
        )}

        {renderImport?.(fieldClass)}

        <div className="flex flex-col gap-2">
          <label htmlFor="startDate" className="text-sm font-medium">
            تاريخ البدء
          </label>
          <input
            id="startDate"
            type="date"
            className={fieldClass}
            value={draft.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
          {draft.startDate && (
            <p className="text-xs text-muted-foreground">الموافق هجريًا: {formatLongDate(draft.startDate)}</p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-sm font-semibold text-muted-foreground">نظام التوزيع</legend>

        <div role="radiogroup" aria-label="نظام التوزيع" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1.5">
          <ModeOption
            active={draft.mode === 'fixed'}
            onSelect={() => onChange({ mode: 'fixed' })}
            icon={<Repeat className="size-4" aria-hidden />}
            title="ورد يومي ثابت"
            hint="كمية محددة كل يوم"
          />
          <ModeOption
            active={draft.mode === 'weekdays'}
            onSelect={() => onChange({ mode: 'weekdays' as PlanMode })}
            icon={<CalendarDays className="size-4" aria-hidden />}
            title="أيام محددة"
            hint="توزيع على أيام مختارة"
          />
        </div>

        {draft.mode === 'fixed' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="daily" className="text-sm font-medium">
              مقدار الورد اليومي <span className="text-muted-foreground">({unit})</span>
            </label>
            <input
              id="daily"
              type="number"
              inputMode="numeric"
              min={1}
              className={fieldClass}
              placeholder="10"
              value={draft.daily || ''}
              onChange={(e) => onChange({ daily: toNumber(e.target.value) })}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span id="weekdays-label" className="text-sm font-medium">
                الأيام المتاحة في الأسبوع
              </span>
              <div role="group" aria-labelledby="weekdays-label" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const active = draft.weekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={active}
                      aria-label={day.label}
                      onClick={() => toggleWeekday(day.value)}
                      className={cn(
                        'h-11 rounded-lg border text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-card text-foreground hover:bg-secondary',
                      )}
                    >
                      {day.short}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="weeks" className="text-sm font-medium">
                عدد الأسابيع
              </label>
              <input
                id="weeks"
                type="number"
                inputMode="numeric"
                min={1}
                className={fieldClass}
                placeholder="4"
                value={draft.weeks || ''}
                onChange={(e) => onChange({ weeks: toNumber(e.target.value) })}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-4 text-sm font-semibold text-muted-foreground">التنبيه</legend>
        <ReminderField
          value={draft.reminderTime ?? ''}
          onChange={(reminderTime) => onChange({ reminderTime })}
          alarm={!!draft.alarmMode}
          onAlarmChange={(alarmMode) => onChange({ alarmMode })}
          fieldClass={fieldClass}
        />
      </fieldset>
    </div>
  )
}

function ModeOption({
  active,
  onSelect,
  icon,
  title,
  hint,
}: {
  active: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-start transition outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-xs">{hint}</span>
    </button>
  )
}

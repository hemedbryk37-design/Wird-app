'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import {
  HIJRI_MONTHS,
  arabicDigits,
  dateToISO,
  daysInHijriMonth,
  formatGregorianLong,
  fromHijri,
  isoToDate,
  toHijri,
} from '@/lib/hijri'

type Props = { value: string; onChange: (iso: string) => void; fieldClass: string }

export function HijriDatePicker({ value, onChange, fieldClass }: Props) {
  const id = useId()
  const today = toHijri(new Date())
  const current = toHijri(isoToDate(value || dateToISO(new Date())))
  const maxDay = daysInHijriMonth(current.y, current.m)
  const first = Math.min(today.y - 1, current.y)
  const last = Math.max(today.y + 10, current.y)
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i)

  const update = (patch: Partial<typeof current>) => {
    const next = { ...current, ...patch }
    next.d = Math.min(next.d, daysInHijriMonth(next.y, next.m))
    onChange(dateToISO(fromHijri(next)))
  }

  const select = cn(fieldClass, 'min-w-0 px-2 text-center')

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-labelledby={`${id}-label`} className="grid grid-cols-[1fr_2fr_1.3fr] gap-2">
        <select aria-label="اليوم" className={select} value={current.d} onChange={(e) => update({ d: Number(e.target.value) })}>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {arabicDigits(d)}
            </option>
          ))}
        </select>
        <select aria-label="الشهر الهجري" className={select} value={current.m} onChange={(e) => update({ m: Number(e.target.value) })}>
          {HIJRI_MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="السنة الهجرية" className={select} value={current.y} onChange={(e) => update({ y: Number(e.target.value) })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {arabicDigits(y)} هـ
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">الموافق ميلاديًا: {formatGregorianLong(dateToISO(fromHijri(current)))}</p>
    </div>
  )
}

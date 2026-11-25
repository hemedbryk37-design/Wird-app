export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
]

export type HijriDate = { y: number; m: number; d: number }

const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' })
const gregorianLong = new Intl.DateTimeFormat('ar-EG-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const gregorianShort = new Intl.DateTimeFormat('ar-EG-u-ca-gregory', { day: 'numeric', month: 'short' })
const digits = new Intl.NumberFormat('ar-EG', { useGrouping: false })

export const arabicDigits = (n: number) => digits.format(n)

const atNoon = (y: number, m: number, d: number) => new Date(y, m, d, 12)

export const isoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return atNoon(y, m - 1, d)
}

export const dateToISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function toHijri(date: Date): HijriDate {
  const found: Partial<HijriDate> = {}
  for (const p of parts.formatToParts(date)) {
    if (p.type === 'year') found.y = Number(p.value)
    if (p.type === 'month') found.m = Number(p.value)
    if (p.type === 'day') found.d = Number(p.value)
  }
  return { y: found.y ?? 1, m: found.m ?? 1, d: found.d ?? 1 }
}

const EPOCH = Date.UTC(622, 6, 19)
const DAY = 86400000

export function fromHijri({ y, m, d }: HijriDate): Date {
  const approx = (y - 1) * 354.367 + (m - 1) * 29.53 + (d - 1)
  const base = new Date(EPOCH + Math.round(approx) * DAY)
  let date = atNoon(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  for (let i = 0; i < 40; i++) {
    const h = toHijri(date)
    if (h.y === y && h.m === m && h.d === d) return date
    const delta = Math.round((y - h.y) * 354.367 + (m - h.m) * 29.53 + (d - h.d))
    const step = delta === 0 ? Math.sign((y - h.y) * 400 + (m - h.m) * 40 + (d - h.d)) : delta
    date = atNoon(date.getFullYear(), date.getMonth(), date.getDate() + step)
  }
  return date
}

export function daysInHijriMonth(y: number, m: number) {
  const probe = toHijri(fromHijri({ y, m, d: 30 }))
  return probe.m === m && probe.y === y ? 30 : 29
}

export const formatGregorianLong = (iso: string) => gregorianLong.format(isoToDate(iso))
export const formatGregorianShort = (iso: string) => gregorianShort.format(isoToDate(iso))

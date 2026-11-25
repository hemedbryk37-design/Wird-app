import { HEMISTICH_SEPARATOR } from './progress'
import { formatNumber, type ScheduleEntry, type UnitKey } from './plan'

export type ImportedBook = { name: string; text: string; wordsPerPage: number; unwrap?: boolean }

export const IMPORT_KEY = 'mutabaa:import'
export const MAX_IMPORT_BYTES = 1.5 * 1024 * 1024
export const DEFAULT_WORDS_PER_PAGE = 250

export type SplitMethod = 'verse-lines' | 'verse-pairs' | 'lines' | 'paragraphs' | 'page-markers' | 'page-words'

export type SplitResult = { segments: string[]; method: SplitMethod }

const PAGE_MARKER_LINE =
  /^\s*(?:-{3,}|={3,}|_{3,}|\*{3,}|\[?\s*(?:صفحة|ص)\s*[:.\-]?\s*[\d٠-٩]+\s*\]?|\[?\s*page\s*[\d]+\s*\]?)\s*$/i
const AYAH_END = /[﴿(]\s*[\d٠-٩]+\s*[﴾)]/g

const nonEmptyLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

function splitAyat(text: string) {
  return nonEmptyLines(text).flatMap((line) => {
    const markers = line.match(AYAH_END)
    if (!markers || markers.length < 2) return [line]
    const parts: string[] = []
    let last = 0
    for (const m of line.matchAll(AYAH_END)) {
      const end = (m.index ?? 0) + m[0].length
      parts.push(line.slice(last, end).trim())
      last = end
    }
    const rest = line.slice(last).trim()
    if (rest) parts.push(rest)
    return parts.filter(Boolean)
  })
}

function splitPagesByMarkers(text: string) {
  const byFormFeed = text.split('\f')
  const pages: string[] = []
  let found = byFormFeed.length > 1
  for (const chunk of byFormFeed) {
    let current: string[] = []
    for (const line of chunk.split('\n')) {
      if (PAGE_MARKER_LINE.test(line)) {
        found = true
        pages.push(current.join('\n'))
        current = []
      } else {
        current.push(line)
      }
    }
    pages.push(current.join('\n'))
  }
  return found ? pages.map((p) => p.trim()).filter(Boolean) : null
}

function splitPagesByWords(text: string, wordsPerPage: number) {
  const tokens = text.split(/(\s+)/)
  const pages: string[] = []
  let current = ''
  let words = 0
  for (const token of tokens) {
    if (!token) continue
    if (/^\s+$/.test(token)) {
      if (current) current += token
      continue
    }
    current += token
    words++
    if (words >= wordsPerPage) {
      pages.push(current.trim())
      current = ''
      words = 0
    }
  }
  if (current.trim()) pages.push(current.trim())
  return pages
}

export function splitBook(book: ImportedBook, unit: UnitKey): SplitResult {
  const text = book.text

  if (unit === 'verse') {
    const lines = nonEmptyLines(text)
    if (lines.some((l) => HEMISTICH_SEPARATOR.test(l))) return { segments: lines, method: 'verse-lines' }
    const pairs: string[] = []
    for (let i = 0; i < lines.length; i += 2) pairs.push(lines.slice(i, i + 2).join('\n'))
    return { segments: pairs, method: 'verse-pairs' }
  }

  if (unit === 'ayah') return { segments: splitAyat(text), method: 'lines' }

  if (unit === 'page') {
    const marked = splitPagesByMarkers(text)
    if (marked && marked.length > 1) return { segments: marked, method: 'page-markers' }
    return { segments: splitPagesByWords(text, Math.max(1, book.wordsPerPage)), method: 'page-words' }
  }

  const unwrap = (p: string) => (book.unwrap ? p.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ') : p)
  const paras = paragraphs(text)
  if (paras.length > 1) return { segments: paras.map(unwrap), method: 'paragraphs' }
  return { segments: nonEmptyLines(text), method: 'lines' }
}

export function describeSplit(method: SplitMethod, wordsPerPage: number) {
  switch (method) {
    case 'verse-lines':
      return 'كل سطر بيت كامل (صدر وعجز بينهما فاصل).'
    case 'verse-pairs':
      return 'كل سطرين متتاليين بيت واحد: الأول صدر والثاني عجز.'
    case 'lines':
      return 'كل سطر وحدة مستقلة، وتُفصل الآيات المرقّمة تلقائيًا.'
    case 'paragraphs':
      return 'كل فقرة يفصلها سطر فارغ وحدة مستقلة.'
    case 'page-markers':
      return 'حسب فواصل الصفحات الموجودة في الملف.'
    case 'page-words':
      return `كل ${formatNumber(wordsPerPage)} كلمة تُعدّ صفحة.`
  }
}

export function joinSegments(unit: UnitKey, segments: string[]) {
  return segments.join(unit === 'verse' || unit === 'ayah' ? '\n' : '\n\n')
}

export function distributeText(unit: UnitKey, segments: string[], schedule: ScheduleEntry[]) {
  return schedule.map((entry) => ({
    index: entry.index,
    text: joinSegments(unit, segments.slice(entry.from - 1, entry.to)),
  }))
}

export async function readTextFile(file: File) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let encoding = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'

  let text: string
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer)
  } catch {
    // Older Arabic text files are often saved in the Windows Arabic code page.
    text = new TextDecoder('windows-1256').decode(buffer)
  }
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

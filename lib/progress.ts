export type DayProgress = { done?: boolean; purged?: boolean }
export type PlanProgress = Record<number, DayProgress>

export const progressKey = (planId: string) => `mutabaa:progress:${planId}`
export const textPrefix = (planId: string) => `mutabaa:text:${planId}:`
export const textKey = (planId: string, index: number) => `${textPrefix(planId)}${index}`
export const TEXT_ROOT = 'mutabaa:text:'

export type Verse = { sadr: string; ajuz: string }

export const HEMISTICH_SEPARATOR = /\s*(?:\*{1,3}|\||…|\.{3,}|\t+|\s{3,}|\s-\s|\s–\s)\s*/

export function parseVerses(text: string): Verse[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const hasSeparators = lines.some((l) => HEMISTICH_SEPARATOR.test(l))
  if (hasSeparators) {
    return lines.map((line) => {
      const match = line.match(HEMISTICH_SEPARATOR)
      if (!match || match.index === undefined) return { sadr: line, ajuz: '' }
      return {
        sadr: line.slice(0, match.index).trim(),
        ajuz: line.slice(match.index + match[0].length).trim(),
      }
    })
  }

  // Without separators, treat consecutive lines as صدر then عجز.
  const verses: Verse[] = []
  for (let i = 0; i < lines.length; i += 2) {
    verses.push({ sadr: lines[i], ajuz: lines[i + 1] ?? '' })
  }
  return verses
}

export function formatBytes(bytes: number) {
  const fmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 })
  if (bytes < 1024) return `${fmt.format(bytes)} بايت`
  if (bytes < 1024 * 1024) return `${fmt.format(bytes / 1024)} ك.ب`
  return `${fmt.format(bytes / (1024 * 1024))} م.ب`
}

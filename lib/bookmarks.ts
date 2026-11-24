import { useLocalStorage } from './use-local-storage'
import type { SavedPlan } from './plan'

export type Bookmark = { day: number; item: number; at: number }
export type Bookmarks = Record<string, Bookmark>
export type Resume = { planId: string; day: number; item: number } | null

export const BOOKMARKS_KEY = 'mutabaa:bookmarks'
export const RESUME_KEY = 'mutabaa:resume'

const EMPTY: Bookmarks = {}

export const useBookmarks = () => useLocalStorage<Bookmarks>(BOOKMARKS_KEY, EMPTY)
export const useResume = () => useLocalStorage<Resume>(RESUME_KEY, null)

export function splitParagraphs(text: string) {
  const blocks = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  if (blocks.length > 1) return blocks
  return text.split('\n').map((p) => p.trim()).filter(Boolean)
}

export function latestBookmark(plans: SavedPlan[], bookmarks: Bookmarks) {
  let best: { plan: SavedPlan; bookmark: Bookmark } | null = null
  for (const plan of plans) {
    const bookmark = bookmarks[plan.id]
    if (!bookmark || !plan.schedule.some((e) => e.index === bookmark.day)) continue
    if (!best || bookmark.at > best.bookmark.at) best = { plan, bookmark }
  }
  return best
}

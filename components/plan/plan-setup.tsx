'use client'

import { useMemo, useState } from 'react'
import { BookmarkCheck, Check, ChevronLeft, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSchedule, createDefaultDraft, type PlanDraft, type SavedPlan } from '@/lib/plan'
import { progressKey, textKey, textPrefix } from '@/lib/progress'
import { removeStorageKeys, useHydrated, useLocalStorage, writeStorageEntries } from '@/lib/use-local-storage'
import { IMPORT_KEY, distributeText, splitBook, type ImportedBook } from '@/lib/book-import'
import { formatNumber } from '@/lib/plan'
import { PlanForm } from './plan-form'
import { BookImport } from './book-import'
import { SchedulePreview } from './schedule-preview'
import { SavedPlans } from './saved-plans'
import { PlanTracker } from './plan-tracker'
import { UpdateButton } from '@/components/update-button'
import { APP_VERSION, APP_VERSION_NOTE } from '@/lib/version'
import { latestBookmark, useBookmarks, useResume } from '@/lib/bookmarks'

const DRAFT_KEY = 'mutabaa:draft'
const PLANS_KEY = 'mutabaa:plans'
const EDITING_KEY = 'mutabaa:editing'
const TRACKING_KEY = 'mutabaa:tracking'

const DEFAULT_DRAFT = createDefaultDraft()
const NO_PLANS: SavedPlan[] = []

export function PlanSetup() {
  const hydrated = useHydrated()
  const [draft, setDraft] = useLocalStorage<PlanDraft>(DRAFT_KEY, DEFAULT_DRAFT)
  const [plans, setPlans] = useLocalStorage<SavedPlan[]>(PLANS_KEY, NO_PLANS)
  const [editingId, setEditingId] = useLocalStorage<string | null>(EDITING_KEY, null)
  const [trackingId, setTrackingId] = useLocalStorage<string | null>(TRACKING_KEY, null)
  const [book, setBook] = useLocalStorage<ImportedBook | null>(IMPORT_KEY, null)
  const [bookmarks, setBookmarks] = useBookmarks()
  const [, setResume] = useResume()
  const last = latestBookmark(plans, bookmarks)
  const [status, setStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const trackedPlan = trackingId ? plans.find((p) => p.id === trackingId) : undefined

  const split = useMemo(() => (book ? splitBook(book, draft.unit) : null), [book, draft.unit])
  const effectiveDraft = useMemo(
    () => (split ? { ...draft, total: split.segments.length } : draft),
    [draft, split],
  )
  const result = useMemo(() => buildSchedule(effectiveDraft), [effectiveDraft])

  const update = (patch: Partial<PlanDraft>) => {
    setStatus(null)
    setSaveError(null)
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const save = () => {
    if (!result.ok) return
    const id = editingId ?? crypto.randomUUID()
    const existing = plans.find((p) => p.id === id)

    if (split && split.segments.length > 0) {
      const days = distributeText(effectiveDraft.unit, split.segments, result.entries)
      removeStorageKeys((k) => k.startsWith(textPrefix(id)))
      const ok = writeStorageEntries(days.map((d) => [textKey(id, d.index), d.text]))
      if (!ok) {
        setSaveError('مساحة التخزين في المتصفح لا تكفي لهذا النص. جرّب ملفًا أصغر أو احذف نصوص الأيام المتقنة.')
        return
      }
    }

    const plan: SavedPlan = {
      ...effectiveDraft,
      id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      schedule: result.entries,
    }
    setPlans((prev) => (existing ? prev.map((p) => (p.id === id ? plan : p)) : [plan, ...prev]))
    setEditingId(id)
    setSaveError(null)
    if (split) {
      setDraft(effectiveDraft)
      setBook(null)
      setStatus(`تم الحفظ ووُزّع النص على ${formatDays(result.entries.length)}`)
    } else {
      setStatus(existing ? 'تم تحديث الخطة' : 'تم حفظ الخطة')
    }
  }

  const reset = () => {
    setDraft(createDefaultDraft())
    setBook(null)
    setEditingId(null)
    setStatus(null)
    setSaveError(null)
  }

  const edit = (plan: SavedPlan) => {
    const { id, createdAt: _createdAt, schedule: _schedule, ...rest } = plan
    setDraft(rest)
    setBook(null)
    setEditingId(id)
    setStatus(null)
    setSaveError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id))
    removeStorageKeys((k) => k === progressKey(id) || k.startsWith(textPrefix(id)))
    if (id === editingId) setEditingId(null)
    if (id === trackingId) setTrackingId(null)
    setBookmarks((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }

  const resumeFromBookmark = () => {
    if (!last) return
    setResume({ planId: last.plan.id, day: last.bookmark.day, item: last.bookmark.item })
    setTrackingId(last.plan.id)
    window.scrollTo({ top: 0 })
  }

  const track = (id: string) => {
    setTrackingId(id)
    window.scrollTo({ top: 0 })
  }

  const canSave = result.ok && draft.title.trim().length > 0

  if (hydrated && trackedPlan) {
    return <PlanTracker plan={trackedPlan} onBack={() => setTrackingId(null)} />
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8 md:py-12">
      {hydrated && last && (
        <button
          type="button"
          onClick={resumeFromBookmark}
          className="flex items-center gap-4 rounded-2xl bg-primary p-4 text-start text-primary-foreground shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <BookmarkCheck className="size-6" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-lg font-bold">أكمل من حيث توقفت</span>
            <span className="truncate text-sm opacity-90">
              {last.plan.title || 'خطة بلا عنوان'} · اليوم {formatNumber(last.bookmark.day)} ·{' '}
              {last.plan.unit === 'verse'
                ? `البيت ${formatNumber((last.plan.schedule.find((e) => e.index === last.bookmark.day)?.from ?? 1) + last.bookmark.item)}`
                : `الفقرة ${formatNumber(last.bookmark.item + 1)}`}
            </span>
          </span>
          <ChevronLeft className="size-6 shrink-0" aria-hidden />
        </button>
      )}

      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">خطة متابعة</p>
        <h1 className="text-3xl font-bold text-balance md:text-4xl">
          {editingId ? 'تعديل خطة المتابعة' : 'إعداد خطة متابعة جديدة'}
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">
          حدّد الكتاب أو المتن ومقداره، ثم اختر طريقة التوزيع ليُحسب لك الجدول وتاريخ الختم تلقائيًا. تُحفظ بياناتك في
          متصفحك.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="form-heading" className="rounded-2xl border border-border bg-card p-5 shadow-xs md:p-7">
          <h2 id="form-heading" className="sr-only">
            بيانات الخطة
          </h2>
          {hydrated ? (
            <PlanForm
              draft={effectiveDraft}
              onChange={update}
              totalLocked={!!split}
              renderImport={(fieldClass) => (
                <BookImport
                  draft={draft}
                  book={book}
                  split={split}
                  fieldClass={fieldClass}
                  onImport={(next) => {
                    setStatus(null)
                    setSaveError(null)
                    setBook(next)
                    if (!draft.title.trim()) update({ title: next.name.replace(/\.txt$/i, '') })
                  }}
                  onChange={(patch) => setBook((prev) => (prev ? { ...prev, ...patch } : prev))}
                  onRemove={() => {
                    setBook(null)
                    if (split) update({ total: split.segments.length })
                  }}
                />
              )}
            />
          ) : (
            <FormSkeleton />
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Button size="lg" onClick={save} disabled={!hydrated || !canSave}>
              <Save aria-hidden />
              {editingId ? 'تحديث الخطة' : 'حفظ الخطة'}
            </Button>
            <Button size="lg" variant="outline" onClick={reset} disabled={!hydrated}>
              <RotateCcw aria-hidden />
              خطة جديدة
            </Button>
            <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm text-primary">
              {status && (
                <>
                  <Check className="size-4" aria-hidden />
                  {status}
                </>
              )}
            </p>
          </div>
          {saveError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {saveError}
            </p>
          )}
          {hydrated && result.ok && !draft.title.trim() && (
            <p className="mt-3 text-xs text-muted-foreground">أدخل اسم الكتاب أو المتن لتتمكن من الحفظ.</p>
          )}
        </section>

        <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
          <h2 id="preview-heading" className="text-lg font-semibold">
            الجدول المقترح
          </h2>
          {hydrated ? (
            <SchedulePreview draft={effectiveDraft} result={result} />
          ) : (
            <div className="min-h-64 animate-pulse rounded-xl bg-muted" />
          )}
        </section>
      </div>

      <section aria-labelledby="saved-heading" className="flex flex-col gap-4">
        <h2 id="saved-heading" className="text-lg font-semibold">
          خططي المحفوظة
        </h2>
        {hydrated && (
          <SavedPlans plans={plans} editingId={editingId} onEdit={edit} onDelete={remove} onTrack={track} />
        )}
      </section>

      <footer className="flex flex-col items-center gap-3 border-t border-border pt-6 text-center">
        <UpdateButton />
        <p className="text-xs text-muted-foreground text-pretty">
          الإصدار {APP_VERSION} - {APP_VERSION_NOTE}
        </p>
      </footer>
    </main>
  )
}

function formatDays(n: number) {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومين'
  const mod = n % 100
  return `${formatNumber(n)} ${mod >= 3 && mod <= 10 ? 'أيام' : 'يومًا'}`
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

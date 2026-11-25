'use client'

import { useId, useRef, useState } from 'react'
import { FileText, FileUp, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatQuantity, type PlanDraft } from '@/lib/plan'
import { DEFAULT_WORDS_PER_PAGE, describeSplit, type ImportedBook, type SplitResult } from '@/lib/book-import'
import { ACCEPTED_BOOKS, ImportError, extractBookText } from '@/lib/book-extract'

type Props = {
  draft: Pick<PlanDraft, 'unit' | 'customUnit'>
  book: ImportedBook | null
  split: SplitResult | null
  onImport: (book: ImportedBook) => void
  onChange: (patch: Partial<ImportedBook>) => void
  onRemove: () => void
  fieldClass: string
}

export function BookImport({ draft, book, split, onImport, onChange, onRemove, fieldClass }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const { text, unwrap } = await extractBookText(file)
      onImport({ name: file.name, text, unwrap, wordsPerPage: book?.wordsPerPage ?? DEFAULT_WORDS_PER_PAGE })
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'تعذّرت قراءة الملف.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPTED_BOOKS}
      className="sr-only"
      onChange={(e) => handleFile(e.target.files?.[0])}
    />
  )

  if (!book || !split) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          نص الكتاب <span className="text-muted-foreground">(اختياري)</span>
        </span>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40',
            dragging ? 'border-primary bg-primary/5' : 'border-input bg-secondary/40 hover:bg-secondary',
          )}
        >
          {fileInput}
          <span className="flex size-10 items-center justify-center rounded-full bg-card text-primary shadow-xs">
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
          </span>
          <span className="text-sm font-semibold text-foreground">رفع ملف كتاب ‎(TXT · DOCX · EPUB · PDF)</span>
          <span className="max-w-xs text-xs leading-relaxed text-muted-foreground text-pretty">
            يُستخرج النص داخل المتصفح دون إنترنت، ويُقسَّم حسب نوع الوحدة ويوزَّع على أيام الجدول عند الحفظ.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  const count = split.segments.length
  const preview = split.segments[0]?.replace(/\s+/g, ' ').slice(0, 120)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      {fileInput}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-xs">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold" dir="auto" title={book.name}>
            {book.name}
          </p>
          <p className="text-sm text-primary">
            {count > 0 ? `قُسّم إلى ${formatQuantity(count, draft)}` : 'لم يُعثر على نص قابل للتقسيم'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setError(null)
            onRemove()
          }}
          aria-label="إزالة الملف"
        >
          <X aria-hidden />
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{describeSplit(split.method, book.wordsPerPage)}</p>

      {split.method === 'page-words' && (
        <div className="flex items-center gap-3">
          <label htmlFor="wordsPerPage" className="text-sm font-medium">
            عدد الكلمات في الصفحة
          </label>
          <input
            id="wordsPerPage"
            type="number"
            inputMode="numeric"
            min={20}
            className={cn(fieldClass, 'h-9 w-24')}
            value={book.wordsPerPage || ''}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value))
              onChange({ wordsPerPage: Number.isFinite(n) && n > 0 ? n : 0 })
            }}
          />
        </div>
      )}

      {preview && (
        <p className="rounded-lg bg-card px-3 py-2 text-sm leading-relaxed text-foreground line-clamp-2" dir="auto">
          <span className="text-muted-foreground">أول وحدة: </span>
          {preview}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          استبدال الملف
        </Button>
        <span className="text-xs text-muted-foreground">الكمية الإجمالية تُحدَّد من الملف تلقائيًا.</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

import { MAX_IMPORT_BYTES, readTextFile } from './book-import'
import { buildPdfText, rowsFromPieces, type PdfPiece, type PdfRow } from './pdf-text'

export class ImportError extends Error {}

export const ACCEPTED_BOOKS =
  '.txt,.docx,.epub,.pdf,text/plain,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const MAX_BINARY_BYTES = 40 * 1024 * 1024

export type BookFormat = 'txt' | 'docx' | 'epub' | 'pdf'

export function detectFormat(file: File): BookFormat | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt'
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub'
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  return null
}

const normalize = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

async function extractDocx(file: File) {
  const mod = (await import('mammoth/mammoth.browser')) as unknown as {
    default?: { extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
    extractRawText?: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
  }
  const api = mod.default ?? mod
  const result = await api.extractRawText!({ arrayBuffer: await file.arrayBuffer() })
  return result.value
}

const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,div,tr,blockquote,section'

function htmlToText(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'text/html')
  doc.querySelectorAll('script,style,head').forEach((n) => n.remove())
  doc.querySelectorAll('br').forEach((n) => n.replaceWith(doc.createTextNode('\n')))
  doc.querySelectorAll(BLOCKS).forEach((n) => n.append(doc.createTextNode('\n\n')))
  return doc.body?.textContent ?? ''
}

const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')

function resolvePath(base: string, href: string) {
  const parts = (base + decodeURIComponent(href.split('#')[0])).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return out.join('/')
}

async function extractEpub(file: File) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const container = await zip.file('META-INF/container.xml')?.async('string')
  if (!container) throw new ImportError('ملف EPUB غير صالح.')
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
  const opfPath = xml(container).querySelector('rootfile')?.getAttribute('full-path')
  const opfText = opfPath ? await zip.file(opfPath)?.async('string') : null
  if (!opfPath || !opfText) throw new ImportError('ملف EPUB غير صالح.')
  const opf = xml(opfText)
  const base = dirname(opfPath)
  const manifest = new Map<string, string>()
  opf.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest.set(id, href)
  })
  let order = Array.from(opf.querySelectorAll('spine > itemref'))
    .map((r) => manifest.get(r.getAttribute('idref') ?? ''))
    .filter((h): h is string => !!h)
  if (order.length === 0) order = Array.from(manifest.values()).filter((h) => /\.(x?html?)$/i.test(h))
  const chapters: string[] = []
  for (const href of order) {
    const entry = zip.file(resolvePath(base, href))
    if (!entry) continue
    const text = normalize(htmlToText(await entry.async('string')))
    if (text) chapters.push(text)
  }
  return chapters.join('\n\n')
}

type PdfItem = { str: string; transform: number[]; width?: number; height?: number }

type PdfLib = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

const errorDetails = (e: unknown) => {
  const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  return text.replace(/\s+/g, ' ').slice(0, 220)
}

async function openPdf(pdfjs: PdfLib, buffer: ArrayBuffer) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  const open = () =>
    pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), isEvalSupported: false, useSystemFonts: false }).promise
  try {
    return await open()
  } catch (first) {
    if (first instanceof Error && /password/i.test(first.name + first.message)) throw first
    try {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
      ;(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = worker
      return await open()
    } catch (second) {
      throw new Error(`فشل تشغيل قارئ PDF (${errorDetails(first)}) | (${errorDetails(second)})`)
    }
  }
}

async function extractPdf(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await openPdf(pdfjs, await file.arrayBuffer())
  const pages: PdfRow[][] = []
  let failed = 0
  let lastError: unknown = null
  for (let n = 1; n <= doc.numPages; n++) {
    try {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const pieces: PdfPiece[] = []
      for (const raw of content.items) {
        const item = raw as PdfItem
        if (typeof item.str !== 'string' || !item.transform) continue
        pieces.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width ?? 0,
          h: item.height || Math.abs(item.transform[3]) || 10,
        })
      }
      pages.push(rowsFromPieces(pieces))
    } catch (e) {
      failed++
      lastError = e
      pages.push([])
    }
  }
  if (failed === doc.numPages) {
    throw new Error(`تعذّر استخراج النص من أي صفحة (${errorDetails(lastError)})`)
  }
  const text = buildPdfText(pages)
  const chars = text.replace(/\s/g, '').length
  if (chars < Math.max(20, doc.numPages * 10)) {
    throw new ImportError('هذا الملف PDF مصوَّر (Scan) ولا يحتوي على نص قابل للاستخراج. حوّله إلى نص بأداة OCR ثم ارفعه.')
  }
  return text
}

export async function extractBookText(file: File) {
  const format = detectFormat(file)
  if (!format) throw new ImportError('الصيغ المدعومة: TXT وDOCX وEPUB وPDF.')
  const limit = format === 'txt' ? MAX_IMPORT_BYTES : MAX_BINARY_BYTES
  if (file.size > limit) {
    throw new ImportError(
      format === 'txt' ? 'الملف كبير جدًا للتخزين في المتصفح؛ الحد الأقصى ١٫٥ م.ب. قسّمه إلى أجزاء.' : 'الملف كبير جدًا؛ الحد الأقصى ٤٠ م.ب.',
    )
  }
  let text: string
  try {
    if (format === 'txt') text = await readTextFile(file)
    else if (format === 'docx') text = await extractDocx(file)
    else if (format === 'epub') text = await extractEpub(file)
    else text = await extractPdf(file)
  } catch (e) {
    if (e instanceof ImportError) throw e
    console.error('book import failed', e)
    if (format === 'pdf' && e instanceof Error && /password/i.test(e.name + e.message)) {
      throw new ImportError('ملف PDF محمي بكلمة مرور.')
    }
    throw new ImportError(
      `تعذّرت قراءة الملف. تأكد أنه سليم وغير تالف، وأن الصيغة مدعومة (‎.doc القديم غير مدعوم؛ احفظه بصيغة ‎.docx).\nالتفاصيل التقنية: ${errorDetails(e)}`,
    )
  }
  text = format === 'pdf' ? text.replace(/\r\n?/g, '\n') : normalize(text)
  if (!text.trim()) throw new ImportError('لم يُعثر على نص داخل الملف.')
  if (new Blob([text]).size > MAX_IMPORT_BYTES) {
    throw new ImportError('النص المستخرج كبير جدًا للتخزين في المتصفح؛ الحد الأقصى ١٫٥ م.ب. قسّم الكتاب إلى أجزاء.')
  }
  return { text, unwrap: format === 'pdf' }
}

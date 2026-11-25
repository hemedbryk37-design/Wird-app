export type PdfPiece = { str: string; x: number; y: number; w: number; h: number }
export type PdfRow = { y: number; text: string }

const MARKS = '\\u064B-\\u065F\\u0670\\u06D6-\\u06ED'
const CLUSTER = new RegExp(`([${MARKS}]*)([^${MARKS}])`, 'gu')
const PRESENTATION = /[\uFB50-\uFDFF\uFE70-\uFEFE]+/g
const JUNK = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uFFFD\uE000-\uF8FF]/g
const KEEP_LTR = /[0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,:/\u066B\u066C][0-9\u0660-\u0669\u06F0-\u06F9]+)*|[A-Za-z]+(?:['’-][A-Za-z]+)*/g
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '«': '»', '»': '«', '<': '>', '>': '<' }
const ARABIC = /[\u0600-\u06FF]/
const END_OF_SENTENCE = /[.!?؟:؛﴾)»"”]$/

const basicClean = (raw: string) => raw.replace(/[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/g, ' ').trim()

export function cleanLine(raw: string) {
  try {
    return raw
      .replace(/\t/g, ' ')
      .replace(JUNK, '')
      .replace(PRESENTATION, (s) => s.normalize('NFKC'))
      .normalize('NFC')
      .replace(/^ +| +$/g, '')
  } catch {
    return basicClean(String(raw))
  }
}

export function reverseLine(line: string) {
  try {
    return reverseLineUnsafe(line)
  } catch {
    return line
  }
}

function reverseLineUnsafe(line: string) {
  const clusters = Array.from(line.matchAll(CLUSTER), (m) => m[2] + Array.from(m[1]).reverse().join('')).reverse()
  const reversed = clusters.join('')
  return reversed
    .replace(KEEP_LTR, (run) => Array.from(run).reverse().join(''))
    .replace(/[()[\]{}«»<>]/g, (c) => MIRROR[c])
}

function orientationScore(text: string) {
  try {
    return orientationScoreUnsafe(text)
  } catch {
    return 0
  }
}

function orientationScoreUnsafe(text: string) {
  const words = text.split(/\s+/).filter((w) => w.length >= 3 && ARABIC.test(w))
  let score = 0
  for (const w of words) {
    if (/^[وفبكل]?ال./.test(w)) score++
    if (/[ةى]$/.test(w)) score++
    if (/.لا[وفبكل]?$/.test(w)) score--
    if (/^[ةى]./.test(w)) score--
  }
  return score
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function rowsFromPieces(pieces: PdfPiece[]): PdfRow[] {
  const rows: (PdfRow & { x: number; w: number })[] = []
  for (const p of pieces) {
    if (!p.str) continue
    const tol = Math.max(2, p.h * 0.4)
    const row = rows.at(-1)
    if (row && Math.abs(row.y - p.y) < tol) {
      if (row.text && !/\s$/.test(row.text) && !/^\s/.test(p.str)) {
        const gap = p.x >= row.x ? p.x - (row.x + row.w) : row.x - (p.x + p.w)
        if (gap > p.h * 1.5) row.text += '   '
        else if (gap > p.h * 0.18) row.text += ' '
      }
      row.text += p.str
      row.x = p.x
      row.w = p.w
    } else if (p.str.trim()) {
      rows.push({ y: p.y, text: p.str, x: p.x, w: p.w })
    }
  }
  return rows.map(({ y, text }) => ({ y, text }))
}

function paragraphs(rows: PdfRow[]) {
  const gaps: number[] = []
  for (let i = 1; i < rows.length; i++) gaps.push(Math.abs(rows[i - 1].y - rows[i].y))
  const typical = median(gaps.filter((g) => g > 0))
  const lengths = rows.map((r) => r.text.length).sort((a, b) => a - b)
  const wide = lengths[Math.floor(lengths.length * 0.8)] ?? 0
  let out = ''
  rows.forEach((row, i) => {
    if (i > 0) {
      const prev = rows[i - 1]
      const bigGap = typical > 0 && Math.abs(prev.y - row.y) > typical * 1.5
      const shortEnd = END_OF_SENTENCE.test(prev.text) && prev.text.length < wide * 0.7
      out += bigGap || shortEnd ? '\n\n' : '\n'
    }
    out += row.text
  })
  return out
}

export function buildPdfText(pages: PdfRow[][]) {
  try {
    return buildPdfTextUnsafe(pages)
  } catch {
    return pages.map((rows) => rows.map((r) => basicClean(r.text)).filter(Boolean).join('\n')).join('\n\f\n')
  }
}

function buildPdfTextUnsafe(pages: PdfRow[][]) {
  const cleaned = pages.map((rows) =>
    rows.map((r) => ({ y: r.y, text: cleanLine(r.text) })).filter((r) => r.text),
  )
  const diffs = cleaned.map((rows) => {
    const normal = rows.map((r) => r.text).join('\n')
    const flipped = rows.map((r) => reverseLine(r.text)).join('\n')
    return orientationScore(flipped) - orientationScore(normal)
  })
  const overall = diffs.reduce((a, b) => a + b, 0)
  const out = cleaned.map((rows, i) => {
    const d = diffs[i]
    const flip = Math.abs(d) >= 3 ? d > 0 : overall >= 3
    return paragraphs(flip ? rows.map((r) => ({ y: r.y, text: reverseLine(r.text) })) : rows)
  })
  return out.join('\n\f\n')
}

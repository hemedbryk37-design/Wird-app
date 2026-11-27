export type PdfPiece = { str: string; x: number; y: number; w: number; h: number }
export type PdfRow = { y: number; text: string }

const MARKS = '\\u064B-\\u065F\\u0670\\u06D6-\\u06ED'
const CLUSTER = new RegExp(`([${MARKS}]*)([^${MARKS}])`, 'gu')
const PRESENTATION = /[\uFB50-\uFDF9\uFDFB-\uFDFF\uFE70-\uFEFE]+/g
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
      .replace(/\s+([\u064B-\u0652\u0670]+)(?=\s|$)/g, '$1')
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

const LETTER = '\\u0621-\\u064A\\u0671-\\u06D3'
const MARK_CLASS = '\\u064B-\\u065F\\u0670'
const RUN = new RegExp(`[${LETTER}${MARK_CLASS}]+`, 'g')
const MARK = new RegExp(`[${MARK_CLASS}]`)
const MARKS_ALL = new RegExp(`[${MARK_CLASS}]`, 'g')
const AFTER = new RegExp(`([^${MARK_CLASS}])([${MARK_CLASS}]*)`, 'gu')

type ClusterMode = 'before' | 'after'

function reverseClusters(text: string, mode: ClusterMode) {
  if (mode === 'before') {
    return Array.from(text.matchAll(CLUSTER), (m) => m[2] + Array.from(m[1]).reverse().join(''))
      .reverse()
      .join('')
  }
  return Array.from(text.matchAll(AFTER), (m) => m[1] + m[2])
    .reverse()
    .join('')
}

function badness(word: string) {
  const letters: { c: string }[] = []
  let bad = 0
  const marks: string[][] = []
  for (const c of Array.from(word)) {
    if (MARK.test(c)) {
      if (!letters.length) bad += 2
      else marks[letters.length - 1].push(c)
    } else {
      letters.push({ c })
      marks.push([])
    }
  }
  letters.forEach((l, i) => {
    const later = letters.length - 1 - i
    const next = letters[i + 1]?.c
    if ((l.c === 'ة' || l.c === 'ى') && letters.length > 1) {
      if (i === 0) bad += 2
      if (later > 0) bad += 2
    }
    for (const m of marks[i]) {
      if ((m === '\u064C' || m === '\u064D') && later > 0) bad += 2
      if (m === '\u064B' && later > 0 && !(later === 1 && (next === 'ا' || next === 'ى'))) bad += 2
    }
  })
  return bad
}

const lineBad = (text: string) => Array.from(text.matchAll(RUN)).reduce((sum, m) => sum + badness(m[0]), 0)

function finishReverse(reversed: string) {
  return reversed
    .replace(KEEP_LTR, (run) => Array.from(run).reverse().join(''))
    .replace(/[()[\]{}«»<>]/g, (c) => MIRROR[c])
}

function reverseLineUnsafe(line: string) {
  const before = finishReverse(reverseClusters(line, 'before'))
  const after = finishReverse(reverseClusters(line, 'after'))
  return lineBad(after) < lineBad(before) ? after : before
}

const WORDS = [
  'الله', 'عليه', 'وسلم', 'عنه', 'عنها', 'عنهم', 'قال', 'قالت', 'رسول', 'النبي', 'تعالى', 'سبحانه', 'حديث', 'كتاب',
  'يقول', 'فقال', 'وقال', 'بعد', 'قبل', 'كانت', 'عند', 'هذا', 'الذي', 'التي', 'الناس', 'الإيمان', 'القرآن', 'أبو',
  'أبي', 'عبد', 'محمد', 'رحمه', 'مقدمة', 'الكتاب', 'العلم', 'الدين', 'الحمد', 'الرحمن', 'الرحيم', 'بسم', 'صلى',
  'وآله', 'وصحبه', 'أجمعين', 'فيه', 'فيها', 'منه', 'منها', 'إليه', 'أيضا', 'حيث', 'كذلك', 'وهي', 'لأن', 'أنه', 'إنه',
]
const FORWARD = new Set(WORDS)
const REVERSED = new Map<string, string>()
for (const w of WORDS) {
  const r = Array.from(w).reverse().join('')
  if (r !== w && !FORWARD.has(r)) REVERSED.set(r, w)
}

const PHRASES: [string, string][] = [
  ['ملسو هلآو هيلع هللا ىلص', 'ﷺ'],
  ['ىلص هللا هيلع هلآو ملسو', 'ﷺ'],
  ['ملسو هيلع هللا ىلص', 'ﷺ'],
  ['ىلص هللا هيلع ملسو', 'ﷺ'],
  ['هنع هللا يضر', 'رضي الله عنه'],
  ['يضر هللا هنع', 'رضي الله عنه'],
  ['اهنع هللا يضر', 'رضي الله عنها'],
  ['يضر هللا اهنع', 'رضي الله عنها'],
  ['مهنع هللا يضر', 'رضي الله عنهم'],
  ['يضر هللا مهنع', 'رضي الله عنهم'],
  ['امهنع هللا يضر', 'رضي الله عنهما'],
  ['يضر هللا امهنع', 'رضي الله عنهما'],
  ['لجو زع', 'عز وجل'],
  ['زع لجو', 'عز وجل'],
  ['هللا همحر', 'رحمه الله'],
  ['همحر هللا', 'رحمه الله'],
]
const PHRASE_RULES = PHRASES.map(
  ([from, to]) => [new RegExp(`(^|[^${LETTER}])${from.replace(/ /g, '\\s+')}(?![${LETTER}])`, 'g'), to] as const,
)

function fixWord(word: string) {
  const bad = badness(word)
  if (bad > 0) {
    let best = word
    let bestBad = bad
    for (const mode of ['after', 'before'] as const) {
      const candidate = reverseClusters(word, mode)
      const score = badness(candidate)
      if (score < bestBad) {
        best = candidate
        bestBad = score
      }
    }
    if (best !== word) return best
  }
  const key = word.replace(MARKS_ALL, '')
  const direct = REVERSED.get(key)
  if (direct) return direct
  const prefix = key.slice(-1)
  if ('وفبلكس'.includes(prefix) && key.length > 3) {
    const rest = REVERSED.get(key.slice(0, -1))
    if (rest) return prefix + rest
  }
  return word
}

export function fixArabicWords(line: string) {
  try {
    let out = line
    for (const [rule, to] of PHRASE_RULES) out = out.replace(rule, (_m, lead: string) => lead + to)
    return out.replace(RUN, fixWord).normalize('NFC')
  } catch {
    return line
  }
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
    const oriented = flip ? rows.map((r) => ({ y: r.y, text: reverseLine(r.text) })) : rows
    return paragraphs(oriented.map((r) => ({ y: r.y, text: fixArabicWords(r.text) })))
  })
  return out.join('\n\f\n')
}

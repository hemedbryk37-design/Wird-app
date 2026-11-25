export type ToneId = 'calm' | 'string' | 'morning' | 'loud' | 'custom'

export const DEFAULT_TONE: ToneId = 'calm'
export const MAX_TONE_BYTES = 5 * 1024 * 1024

export const TONE_OPTIONS: { value: ToneId; label: string }[] = [
  { value: 'calm', label: 'رنين هادئ' },
  { value: 'string', label: 'نغمة وترية' },
  { value: 'morning', label: 'تنبيه الصباح' },
  { value: 'loud', label: 'منبه قوي' },
  { value: 'custom', label: 'نغمة مخصصة من جهازي' },
]

export type ToneHandle = { stop: () => void; done: Promise<void> }

type Note = { f: number; t: number; d: number; w: OscillatorType; g: number; h?: number }

const seq = (freqs: number[], step: number, d: number, w: OscillatorType, g: number, h?: number): Note[] =>
  freqs.map((f, i) => ({ f, t: i * step, d, w, g, h }))

const PATTERNS: Record<Exclude<ToneId, 'custom'>, Note[]> = {
  calm: seq([523.25, 659.25, 783.99, 1046.5], 0.55, 1.6, 'sine', 0.22, 2),
  string: seq([392, 493.88, 587.33, 783.99, 587.33, 493.88], 0.32, 0.8, 'triangle', 0.26, 3),
  morning: [
    ...seq([523.25, 659.25, 783.99], 0.22, 0.4, 'sine', 0.24, 2),
    { f: 1046.5, t: 0.9, d: 1.3, w: 'sine', g: 0.26, h: 2 },
    { f: 783.99, t: 1.3, d: 1.2, w: 'triangle', g: 0.16 },
  ],
  loud: Array.from({ length: 10 }, (_, i) => ({ f: i % 2 ? 660 : 880, t: i * 0.18, d: 0.16, w: 'square' as OscillatorType, g: 0.3 })),
}

let ctx: AudioContext | null = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

function schedule(c: AudioContext, out: AudioNode, notes: Note[]) {
  const base = c.currentTime + 0.05
  let end = 0
  for (const n of notes) {
    const layers = n.h ? [{ m: 1, g: n.g }, { m: n.h, g: n.g * 0.25 }] : [{ m: 1, g: n.g }]
    for (const l of layers) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      const s = base + n.t
      osc.type = n.w
      osc.frequency.value = n.f * l.m
      gain.gain.setValueAtTime(0.0001, s)
      gain.gain.exponentialRampToValueAtTime(l.g, s + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, s + n.d)
      osc.connect(gain).connect(out)
      osc.start(s)
      osc.stop(s + n.d + 0.05)
    }
    end = Math.max(end, n.t + n.d)
  }
  return end
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('wird-db', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('tones')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction('tones', mode).objectStore('tones'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export type CustomTone = { name: string; blob: Blob }

export const saveCustomTone = (file: File) => run('readwrite', (s) => s.put({ name: file.name, blob: file }, 'custom'))
export const loadCustomTone = () => run<CustomTone | undefined>('readonly', (s) => s.get('custom'))
export const clearCustomTone = () => run('readwrite', (s) => s.delete('custom'))

export const isAudioFile = (file: File) => /\.(mp3|wav|ogg)$/i.test(file.name) || /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg)$/i.test(file.type)

export async function playTone(id: ToneId, options: { loop?: boolean; maxMs?: number } = {}): Promise<ToneHandle | null> {
  const { loop = false, maxMs = 60000 } = options
  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => (finish = resolve))

  if (id === 'custom') {
    const saved = await loadCustomTone().catch(() => undefined)
    if (!saved) return null
    const url = URL.createObjectURL(saved.blob)
    const audio = new Audio(url)
    audio.loop = loop
    const timer = setTimeout(() => stop(), maxMs)
    let ended = false
    function stop() {
      if (ended) return
      ended = true
      clearTimeout(timer)
      audio.pause()
      URL.revokeObjectURL(url)
      finish()
    }
    audio.onended = stop
    audio.onerror = stop
    await audio.play().catch(() => stop())
    return { stop, done }
  }

  const c = getCtx()
  if (!c) return null
  if (c.state === 'suspended') await c.resume().catch(() => {})
  const master = c.createGain()
  master.connect(c.destination)
  const notes = PATTERNS[id]
  const length = schedule(c, master, notes)
  let interval: ReturnType<typeof setInterval> | undefined
  let ended = false
  const limit = setTimeout(() => stop(), loop ? maxMs : (length + 0.3) * 1000)
  function stop() {
    if (ended) return
    ended = true
    clearInterval(interval)
    clearTimeout(limit)
    master.gain.cancelScheduledValues(c!.currentTime)
    master.gain.setValueAtTime(0, c!.currentTime)
    setTimeout(() => master.disconnect(), 100)
    finish()
  }
  if (loop) interval = setInterval(() => schedule(c, master, notes), (length + 0.9) * 1000)
  if (loop) navigator.vibrate?.([400, 200, 400, 200, 400])
  return { stop, done }
}

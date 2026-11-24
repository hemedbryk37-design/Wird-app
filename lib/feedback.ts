let audioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  audioContext ??= new Ctor()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function playChime() {
  const ctx = getAudioContext()
  if (!ctx) return
  const start = ctx.currentTime
  // A soft rising major arpeggio: C5, E5, G5.
  ;[523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = start + i * 0.09
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.5)
  })
}

export function celebrate() {
  try {
    playChime()
  } catch {
    // Audio can be blocked by the browser; vibration below still applies.
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([40, 40, 70])
  }
}

export function startAlarm(onEnd: () => void) {
  const ctx = getAudioContext()
  if (!ctx) {
    onEnd()
    return () => {}
  }
  const beep = () => {
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const s = t + i * 0.25
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, s)
      gain.gain.exponentialRampToValueAtTime(0.3, s + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(s)
      osc.stop(s + 0.22)
    }
    navigator.vibrate?.([300, 150, 300, 150, 300])
  }
  let done = false
  const id = setInterval(beep, 1500)
  const end = setTimeout(() => stop(), 60000)
  function stop() {
    if (done) return
    done = true
    clearInterval(id)
    clearTimeout(end)
    navigator.vibrate?.(0)
    onEnd()
  }
  beep()
  return stop
}

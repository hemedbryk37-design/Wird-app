'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startAlarm } from '@/lib/feedback'
import type { SavedPlan } from '@/lib/plan'
import { notifyIfDue, parseTime } from '@/lib/reminders'
import { useLocalStorage } from '@/lib/use-local-storage'

const NO_PLANS: SavedPlan[] = []

export function AppServices() {
  const [plans] = useLocalStorage<SavedPlan[]>('mutabaa:plans', NO_PLANS)
  const [tick, setTick] = useState(0)
  const [ringing, setRinging] = useState<string | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const ring = useCallback((title: string) => {
    stopRef.current?.()
    setRinging(title)
    stopRef.current = startAlarm(() => setRinging(null))
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Re-evaluate reminders when the app returns to the foreground, since
  // background timers are throttled or frozen by the browser.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  useEffect(() => {
    const now = new Date()
    const timers: ReturnType<typeof setTimeout>[] = []

    for (const plan of plans) {
      const time = parseTime(plan.reminderTime)
      if (!time) continue
      const at = new Date(now)
      at.setHours(time.h, time.m, 0, 0)
      const delay = at.getTime() - now.getTime()
      const fire = (at?: Date) =>
        notifyIfDue(plan, at).then((fired) => {
          if (fired && plan.alarmMode) ring(plan.title || 'خطتك')
        })
      if (delay <= 0) void fire(now)
      else timers.push(setTimeout(() => void fire(), delay))
    }

    const midnight = new Date(now)
    midnight.setHours(24, 0, 5, 0)
    timers.push(setTimeout(() => setTick((t) => t + 1), midnight.getTime() - now.getTime()))

    return () => timers.forEach(clearTimeout)
  }, [plans, tick, ring])

  if (!ringing) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg"
    >
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="size-5 animate-pulse" aria-hidden />
        حان وقت ورد: {ringing}
      </p>
      <Button variant="secondary" onClick={() => stopRef.current?.()}>
        إيقاف
      </Button>
    </div>
  )
}

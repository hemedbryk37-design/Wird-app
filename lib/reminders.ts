import { formatNumber, formatQuantity, toISODate, type SavedPlan, type ScheduleEntry } from './plan'
import { progressKey, type PlanProgress } from './progress'

export type NotificationState = NotificationPermission | 'unsupported'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export const getNotificationState = (): NotificationState =>
  notificationsSupported() ? Notification.permission : 'unsupported'

const notifiedKey = (planId: string) => `mutabaa:notified:${planId}`

async function showNotification(title: string, body: string, tag: string, alarm = false) {
  const options = {
    body,
    tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    ...(alarm ? { requireInteraction: true, renotify: true, silent: false, vibrate: [500, 200, 500, 200, 500, 200, 500] } : {}),
  } as NotificationOptions
  // Mobile browsers only allow notifications through a service worker registration.
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
  if (registration) return registration.showNotification(title, options)
  new Notification(title, options)
}

export function sendTestNotification() {
  return showNotification('تنبيهات الورد مفعّلة', 'ستصلك رسالة في الموعد الذي حددته بعنوان الورد والكمية المطلوبة.', 'mutabaa-test')
}

export function readProgress(planId: string): PlanProgress {
  try {
    return JSON.parse(localStorage.getItem(progressKey(planId)) ?? '{}') as PlanProgress
  } catch {
    return {}
  }
}

export const reminderTitle = (plan: SavedPlan) => `حان وقت ورد: ${plan.title || 'خطتك'}`

export const reminderBody = (plan: SavedPlan, entry: ScheduleEntry) =>
  `المطلوب اليوم: ${formatQuantity(entry.amount, plan)} (من ${formatNumber(entry.from)} إلى ${formatNumber(entry.to)})`

export function parseTime(time: string | undefined) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m }
}

/** Sends today's reminder for a plan once per day, only if today's portion is still pending. */
export async function notifyIfDue(plan: SavedPlan, now = new Date()) {
  const today = toISODate(now)
  const entry = plan.schedule.find((e) => e.date === today)
  if (!entry || readProgress(plan.id)[entry.index]?.done) return false
  if (localStorage.getItem(notifiedKey(plan.id)) === today) return false
  localStorage.setItem(notifiedKey(plan.id), today)
  if (getNotificationState() !== 'granted') return true

  await showNotification(
    reminderTitle(plan),
    reminderBody(plan, entry),
    `mutabaa-${plan.id}`,
    !!plan.alarmMode,
  )
  return true
}

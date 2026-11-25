import { parseISODate, type SavedPlan, type ScheduleEntry } from './plan'
import { DEFAULT_TONE, type ToneId } from './tones'
import { parseTime, readProgress, reminderBody, reminderTitle } from './reminders'

const HORIZON_DAYS = 45
const MAX_PENDING = 120

type CapacitorGlobal = { isNativePlatform?: () => boolean }

export const isNative = () =>
  typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.()

const loadPlugin = async () => (await import('@capacitor/local-notifications')).LocalNotifications

const hash = (value: string) => {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 2147483000) + 1
}

const channelFor = (tone: ToneId, alarm: boolean) => ({
  id: `wird-${tone}-${alarm ? 'alarm' : 'normal'}`,
  name: alarm ? `منبه الورد (${tone})` : `تنبيه الورد (${tone})`,
  description: 'تنبيهات الورد اليومي',
  importance: (alarm ? 5 : 4) as 4 | 5,
  visibility: 1 as const,
  vibration: true,
  lights: true,
  ...(tone === 'custom' ? {} : { sound: `wird_${tone}.wav` }),
})

export async function prepareNativeAlarm() {
  if (!isNative()) return
  const plugin = await loadPlugin()
  await plugin.requestPermissions()
  const exact = await plugin.checkExactNotificationSetting().catch(() => null)
  if (exact && exact.exact_alarm !== 'granted') await plugin.changeExactNotificationSetting().catch(() => {})
}

export async function scheduleNativeAlarms(plans: SavedPlan[]) {
  if (!isNative()) return
  const plugin = await loadPlugin()
  const now = Date.now()
  const limit = now + HORIZON_DAYS * 86400000
  const items: { at: Date; plan: SavedPlan; entry: ScheduleEntry }[] = []

  for (const plan of plans) {
    const time = parseTime(plan.reminderTime)
    if (!time) continue
    const progress = readProgress(plan.id)
    for (const entry of plan.schedule) {
      if (progress[entry.index]?.done) continue
      const at = parseISODate(entry.date)
      at.setHours(time.h, time.m, 0, 0)
      if (at.getTime() > now && at.getTime() < limit) items.push({ at, plan, entry })
    }
  }
  items.sort((a, b) => a.at.getTime() - b.at.getTime())
  const chosen = items.slice(0, MAX_PENDING)

  const pending = await plugin.getPending()
  if (pending.notifications.length) {
    await plugin.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  if (!chosen.length) return

  const granted = await plugin.checkPermissions()
  if (granted.display !== 'granted') {
    const asked = await plugin.requestPermissions()
    if (asked.display !== 'granted') return
  }

  const channels = new Map<string, ReturnType<typeof channelFor>>()
  for (const { plan } of chosen) {
    const channel = channelFor(plan.tone ?? DEFAULT_TONE, !!plan.alarmMode)
    channels.set(channel.id, channel)
  }
  for (const channel of channels.values()) await plugin.createChannel(channel)

  await plugin.schedule({
    notifications: chosen.map(({ at, plan, entry }) => ({
      id: hash(`${plan.id}:${entry.index}`),
      title: reminderTitle(plan),
      body: reminderBody(plan, entry),
      channelId: channelFor(plan.tone ?? DEFAULT_TONE, !!plan.alarmMode).id,
      schedule: { at, allowWhileIdle: true },
      autoCancel: true,
    })),
  })
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, BellRing, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  MAX_TONE_BYTES,
  TONE_OPTIONS,
  clearCustomTone,
  isAudioFile,
  loadCustomTone,
  playTone,
  saveCustomTone,
  type ToneHandle,
  type ToneId,
} from '@/lib/tones'
import { getNotificationState, sendTestNotification, type NotificationState } from '@/lib/reminders'

type Props = {
  value: string
  onChange: (value: string) => void
  tone: ToneId
  onToneChange: (value: ToneId) => void
  alarm: boolean
  onAlarmChange: (value: boolean) => void
  fieldClass: string
}

export function ReminderField({ value, onChange, tone, onToneChange, alarm, onAlarmChange, fieldClass }: Props) {
  const [permission, setPermission] = useState<NotificationState>(getNotificationState)
  const [customName, setCustomName] = useState<string | null>(null)
  const [toneError, setToneError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const handle = useRef<ToneHandle | null>(null)

  useEffect(() => {
    loadCustomTone()
      .then((saved) => setCustomName(saved?.name ?? null))
      .catch(() => {})
    return () => handle.current?.stop()
  }, [])

  const stopPreview = () => {
    handle.current?.stop()
    handle.current = null
    setPlaying(false)
  }

  const preview = async () => {
    if (playing) return stopPreview()
    setToneError(null)
    const started = await playTone(tone, { maxMs: 10000 })
    if (!started) {
      setToneError(tone === 'custom' ? 'ارفع ملفًا صوتيًا أولًا.' : 'تعذّر تشغيل الصوت على هذا الجهاز.')
      return
    }
    handle.current = started
    setPlaying(true)
    void started.done.then(() => {
      if (handle.current === started) {
        handle.current = null
        setPlaying(false)
      }
    })
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setToneError(null)
    if (!isAudioFile(file)) return setToneError('الصيغ المدعومة: MP3 وWAV وOGG.')
    if (file.size > MAX_TONE_BYTES) return setToneError('الملف كبير؛ الحد الأقصى ٥ م.ب.')
    try {
      await saveCustomTone(file)
      setCustomName(file.name)
      onToneChange('custom')
    } catch {
      setToneError('تعذّر حفظ الملف في المتصفح.')
    }
  }

  const removeCustom = async () => {
    stopPreview()
    await clearCustomTone().catch(() => {})
    setCustomName(null)
    if (tone === 'custom') onToneChange('calm')
  }

  const enable = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') void sendTestNotification()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="reminderTime" className="text-sm font-medium">
          وقت التنبيه اليومي <span className="text-muted-foreground">(اختياري)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="reminderTime"
            type="time"
            className={fieldClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => onChange('')}
              aria-label="إلغاء التنبيه"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="toneSelect" className="text-sm font-medium">
          نغمة التنبيه
        </label>
        <div className="flex gap-2">
          <select
            id="toneSelect"
            className={fieldClass}
            value={tone}
            onChange={(e) => {
              stopPreview()
              setToneError(null)
              onToneChange(e.target.value as ToneId)
            }}
          >
            {TONE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 text-lg"
            onClick={() => void preview()}
            aria-label={playing ? 'إيقاف التجربة' : 'تجربة النغمة'}
          >
            {playing ? '⏹' : '🔊'}
          </Button>
        </div>
        {tone === 'custom' && (
          <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm">
            <label className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="rounded-md border border-input bg-card px-3 py-1.5 font-medium">
                {customName ? 'استبدال الملف الصوتي' : 'اختيار ملف صوتي'}
              </span>
              <span className="min-w-0 truncate text-muted-foreground" dir="auto">
                {customName ?? 'MP3 · WAV · OGG'}
              </span>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                className="sr-only"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {customName && (
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => void removeCustom()}>
                حذف النغمة المحفوظة
              </Button>
            )}
          </div>
        )}
        {toneError && (
          <p role="alert" className="text-sm text-destructive">
            {toneError}
          </p>
        )}
        <p className="text-xs text-muted-foreground text-pretty">
          تُسمَع النغمة عند فتح التطبيق وقت التنبيه؛ أما والتطبيق مغلق فيستخدم النظام صوت الإشعار الافتراضي.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span id="alarmLabel" className="text-sm font-medium">
            تجاوز وضع الصامت - وضع المنبه
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={alarm}
            aria-labelledby="alarmLabel"
            onClick={() => onAlarmChange(!alarm)}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full border border-input transition outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
              alarm ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5.5 rounded-full bg-card shadow-sm transition-all',
                alarm ? 'end-0.5' : 'end-5.5',
              )}
            />
          </button>
        </div>
        {alarm && (
          <p className="text-xs text-muted-foreground text-pretty">
            يبقى الإشعار ظاهرًا مع اهتزاز قوي، ويرنّ صوت منبه عبر مستوى الوسائط عند فتح التطبيق. تجاوز الصامت بالكامل والتطبيق مغلق يتطلب تطبيق أندرويد أصلي.
          </p>
        )}
      </div>

      {value && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm" role="status" aria-live="polite">
          {permission === 'granted' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-primary">
                <BellRing className="size-4" aria-hidden />
                الإشعارات مفعّلة لهذا المتصفح.
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={() => void sendTestNotification()}>
                تجربة الإشعار
              </Button>
            </div>
          )}
          {permission === 'default' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-pretty">اسمح بالإشعارات ليصلك تنبيه الورد في موعده.</p>
              <Button type="button" size="sm" onClick={() => void enable()}>
                <Bell aria-hidden />
                تفعيل الإشعارات
              </Button>
            </div>
          )}
          {permission === 'denied' && (
            <p className="flex items-start gap-2 text-destructive text-pretty">
              <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              الإشعارات محظورة. فعّلها من إعدادات الموقع في المتصفح ثم أعد تحميل الصفحة.
            </p>
          )}
          {permission === 'unsupported' && (
            <p className="text-muted-foreground text-pretty">هذا المتصفح لا يدعم الإشعارات.</p>
          )}
          <p className="text-xs text-muted-foreground text-pretty">
            يصل التنبيه بعنوان الورد وكمية اليوم ما دام التطبيق مفتوحًا أو مثبّتًا في الخلفية، وإن فات موعده يظهر عند فتح
            التطبيق إذا لم تُنجز ورد اليوم بعد.
          </p>
        </div>
      )}
    </div>
  )
}

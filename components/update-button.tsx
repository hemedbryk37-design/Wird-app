'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UpdateButton() {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
      await Promise.all(regs.map((r) => r.unregister()))
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch {}
    location.reload()
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      تحديث التطبيق الآن
    </Button>
  )
}

'use client'

import { useEffect, useState } from 'react'
import WhatsNewPopup, {
  fetchLatestWhatsNew,
  getDismissedVersion,
  type WhatsNewEntry,
} from '@/components/ui/WhatsNewPopup'

/**
 * Surfaces the What's New popup automatically after a release.
 *
 * Mounted once in AppShell, so it runs on any signed-in page. It shows the
 * latest entry unless this browser already dismissed that exact version —
 * WhatsNewPopup writes that marker on close, so each release is seen once.
 * Silent on failure: an unreachable table must never block the app behind a
 * modal, so we simply render nothing.
 */
export default function WhatsNewGate() {
  const [entry, setEntry] = useState<WhatsNewEntry | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const latest = await fetchLatestWhatsNew()
      if (!alive || !latest) return
      if (getDismissedVersion() === latest.version) return
      setEntry(latest)
    })()
    return () => { alive = false }
  }, [])

  if (!entry) return null
  return <WhatsNewPopup open entry={entry} onClose={() => setEntry(null)} />
}

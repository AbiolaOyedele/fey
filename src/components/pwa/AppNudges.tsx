'use client'

import { usePushSubscription } from '@/hooks/usePush'
import AppNudgeCards from './AppNudgeCards'

/** The app's own install / notification nudges. See `AppNudgeCards`. */
export default function AppNudges() {
  const push = usePushSubscription()
  return (
    <AppNudgeCards
      push={push}
      appName="Fey"
      storageKey="fey"
      pushReason="Get alerts for client messages, tasks and payments — even when Fey is closed."
    />
  )
}

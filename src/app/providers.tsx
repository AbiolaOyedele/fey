'use client'

import { MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { DemoProvider } from '@/contexts/DemoContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { IS_DEMO } from '@/lib/constants'
import PostHogProvider from '@/components/analytics/PostHogProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  // reducedMotion="user" makes every framer-motion animation in the app honour the
  // OS "reduce motion" setting automatically.
  return (
    <PostHogProvider>
      <MotionConfig reducedMotion="user">
        <ConfirmProvider>
          {IS_DEMO ? (
            <DemoProvider>{children}</DemoProvider>
          ) : (
            <AuthProvider>
              <SettingsProvider>{children}</SettingsProvider>
            </AuthProvider>
          )}
        </ConfirmProvider>
      </MotionConfig>
    </PostHogProvider>
  )
}

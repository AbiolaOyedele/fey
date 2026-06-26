'use client'

import { MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { DemoProvider } from '@/contexts/DemoContext'
import { IS_DEMO } from '@/lib/constants'

export default function Providers({ children }: { children: React.ReactNode }) {
  // reducedMotion="user" makes every framer-motion animation in the app honour the
  // OS "reduce motion" setting automatically.
  return (
    <MotionConfig reducedMotion="user">
      {IS_DEMO ? (
        <DemoProvider>{children}</DemoProvider>
      ) : (
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      )}
    </MotionConfig>
  )
}

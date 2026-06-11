'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { DemoProvider } from '@/contexts/DemoContext'
import { IS_DEMO } from '@/lib/constants'

export default function Providers({ children }: { children: React.ReactNode }) {
  if (IS_DEMO) {
    return <DemoProvider>{children}</DemoProvider>
  }

  return (
    <AuthProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </AuthProvider>
  )
}

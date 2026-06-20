import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Fey',
  description: 'Track your work & earnings',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-appbg overflow-x-hidden">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}

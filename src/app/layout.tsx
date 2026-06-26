import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Fey',
  description: 'Track your work, clients & earnings',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icon-maskable.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Fey',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preload NoirPro so it fetches immediately on every origin — without
            this, a freshly-created workspace subdomain (cold font cache) shows
            the system fallback font until the CSS @font-face downloads, which
            reads as "the app font changed". Fonts are always fetched in CORS
            mode, so crossOrigin must be set for the preload to be reused. */}
        <link rel="preload" href="/fonts/NoirPro-Light.otf" as="font" type="font/otf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/NoirPro-Regular.otf" as="font" type="font/otf" crossOrigin="anonymous" />
      </head>
      <body className="h-full bg-appbg overflow-x-hidden">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}

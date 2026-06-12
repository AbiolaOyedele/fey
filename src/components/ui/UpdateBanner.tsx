'use client'

import { RefreshCw } from 'lucide-react'

interface UpdateBannerProps {
  show:   boolean
  accent: string
}

/**
 * Bottom-docked prompt shown when a newer version of the app has been deployed.
 * Styled to match the app's toast system (accent fill, rounded-2xl, slide-up).
 */
export default function UpdateBanner({ show, accent }: UpdateBannerProps) {
  if (!show) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[60] w-[calc(100%-3rem)] max-w-sm">
      <div
        className="flex items-center gap-3 text-white px-5 py-3.5 rounded-2xl shadow-lg animate-slideUp"
        style={{ backgroundColor: accent }}
      >
        <RefreshCw size={17} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">A new update is ready</p>
          <p className="text-[12px] text-white/75 leading-tight mt-0.5">Refresh to get the latest version.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex-shrink-0 text-sm font-semibold px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}

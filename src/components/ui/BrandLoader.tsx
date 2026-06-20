'use client'

interface BrandLoaderProps {
  /** Workspace/company logo URL. Falls back to the Fey "F" mark. */
  logo?: string | null
  /** Logo size in px (the ring sits ~16px larger). */
  size?: number
  /** Center it in a full-height branded backdrop. */
  fullscreen?: boolean
}

/**
 * Brand loader — the logo centered inside a spinning accent ring. Used for the
 * app's initial load gate; placeholder styling, fine-tune later.
 */
export default function BrandLoader({ logo, size = 52, fullscreen = false }: BrandLoaderProps) {
  const ring = size + 16
  const inner = (
    <div className="relative flex items-center justify-center" style={{ width: ring, height: ring }}>
      <div
        className="absolute inset-0 rounded-full border-2 border-gray-200 animate-spin"
        style={{ borderTopColor: 'var(--accent, #ED64A6)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo || '/favicon.svg'}
        alt="Loading"
        className="rounded-2xl object-contain"
        style={{ width: size, height: size }}
      />
    </div>
  )
  if (!fullscreen) return inner
  return <div className="flex h-screen items-center justify-center bg-appbg">{inner}</div>
}

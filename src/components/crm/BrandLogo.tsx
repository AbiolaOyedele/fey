'use client'

/**
 * A brand's logo, wherever a brand appears.
 *
 * Brands used to be drawn with a sparkle icon on an accent tile — the same
 * shape for every one of them, which made a grid of real clients read as
 * placeholder UI. A logo is the one thing that tells them apart at a glance, so
 * it's shown whenever there is one.
 *
 * The fallback is the brand's initial rather than an icon: still generic, but at
 * least specific to that brand, and it never looks like a missing image.
 *
 * A plain `<img>` on purpose — logos are Cloudinary URLs uploaded by users, the
 * same as the workspace logo and avatars elsewhere, and none of them go through
 * next/image (no remote pattern is configured for that host).
 */

interface BrandLogoProps {
  name: string
  logoUrl: string | null | undefined
  accent: string
  /** Tailwind size classes for the tile, e.g. 'w-11 h-11'. */
  className?: string
  /** Corner radius class; defaults to the app's tile radius. */
  rounded?: string
  /** Font size for the fallback initial. */
  textClassName?: string
}

export default function BrandLogo({
  name,
  logoUrl,
  accent,
  className = 'w-11 h-11',
  rounded = 'rounded-xl',
  textClassName = 'text-base',
}: BrandLogoProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        // `contain` on a white tile: a logo cropped to fill would lose the
        // wordmark on anything that isn't square, which most logos aren't.
        className={`${className} ${rounded} object-contain bg-white border border-gray-100 flex-shrink-0`}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`${className} ${rounded} flex items-center justify-center font-semibold flex-shrink-0 ${textClassName}`}
      style={{ backgroundColor: `${accent}15`, color: accent }}
    >
      {initial}
    </span>
  )
}

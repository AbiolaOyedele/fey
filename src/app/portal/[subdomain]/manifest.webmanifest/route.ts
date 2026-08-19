import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getOwnerByWorkspaceSlug } from '@/repositories/portal.repository'

/**
 * GET /portal/<slug>/manifest.webmanifest
 *
 * The install manifest for one agency's client portal.
 *
 * A client portal is a white-labelled product, so installing it must add the
 * agency to the home screen — their name, their logo, their colour. The app's
 * own manifest is Fey's, and pointing a client at it would put a Fey icon on
 * their phone for a product they have never heard of.
 *
 * start_url and scope are relative on purpose. The same portal is reachable at
 * /client/* on the agency's subdomain and /portal/<slug>/* everywhere else, and
 * "." resolves against wherever the manifest was fetched from — so one document
 * is correct on both without the server needing to know which host asked.
 */

/** A square PNG of the agency's logo, if it's one of ours to transform. */
function iconSet(logoUrl: string | null): Array<{ src: string; sizes: string; type: string; purpose?: string }> {
  const cloudinary = logoUrl && /^https:\/\/res\.cloudinary\.com\//.test(logoUrl) && logoUrl.includes('/upload/')
  if (!cloudinary) {
    // No usable logo. Fey's marks are the honest fallback — a blank icon or a
    // broken image would be worse than an unbranded one.
    return [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ]
  }
  const at = (size: number) =>
    logoUrl.replace('/upload/', `/upload/w_${size},h_${size},c_pad,b_white,f_png,q_auto/`)
  return [
    { src: at(192), sizes: '192x192', type: 'image/png' },
    { src: at(512), sizes: '512x512', type: 'image/png' },
    // Maskable icons get cropped to a circle on Android, so the logo is padded
    // into the safe area rather than losing its edges.
    {
      src: logoUrl.replace('/upload/', '/upload/w_409,h_409,c_pad,b_white/w_512,h_512,c_pad,b_white,f_png,q_auto/'),
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params
  const branding = await getOwnerByWorkspaceSlug(createServiceClient(), subdomain)

  const name = branding?.business_name ?? 'Client Portal'
  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description: `Your projects, files and messages with ${name}.`,
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: branding?.accent_color ?? '#ED64A6',
    icons: iconSet(branding?.logo_url ?? null),
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Branding changes rarely, and a stale name for a few minutes is a much
      // smaller problem than a database read on every portal page view.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

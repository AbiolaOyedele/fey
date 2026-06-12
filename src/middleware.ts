import { NextRequest, NextResponse } from 'next/server'

// Root domain for workspace subdomains. Anything at <slug>.theruff.agency is a
// tenant workspace; the hosts below are NOT workspaces and pass through.
const ROOT_DOMAIN = 'theruff.agency'
const RESERVED = new Set(['dashboard', 'www', 'app', 'api', 'admin', 'staging', 'preview'])

/**
 * Wildcard subdomain routing.
 *
 *   <slug>.theruff.agency/...          → owner admin app (served at the root,
 *                                         host-agnostic; the slug is cosmetic)
 *   <slug>.theruff.agency/portal/...   → that workspace's client portal, with
 *                                         the slug injected from the host so URLs
 *                                         stay clean (/portal/join, not
 *                                         /portal/<slug>/join)
 *
 * dashboard.theruff.agency, www, previews, and localhost are untouched, so the
 * existing path-based behaviour keeps working.
 */
export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? ''

  // Only *.theruff.agency hosts are candidates.
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return NextResponse.next()

  const sub = host.slice(0, host.length - ROOT_DOMAIN.length - 1)
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return NextResponse.next()

  // sub is a workspace slug.
  const path = req.nextUrl.pathname

  // Portal routes: inject the slug from the host unless it's already there.
  if (path === '/portal' || path.startsWith('/portal/')) {
    const rest = path.slice('/portal'.length)               // '' | '/login' | '/<slug>/login'
    const firstSeg = rest.split('/').filter(Boolean)[0]
    if (firstSeg !== sub) {
      const url = req.nextUrl.clone()
      url.pathname = `/portal/${sub}${rest}`
      return NextResponse.rewrite(url)
    }
  }

  // Everything else (owner app, /auth, etc.) is served as-is on the subdomain.
  return NextResponse.next()
}

export const config = {
  // Skip Next internals, API routes, and any path with a file extension.
  matcher: ['/((?!_next/|api/|favicon.ico|.*\\.[\\w]+$).*)'],
}

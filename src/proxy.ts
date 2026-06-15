import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Workspace subdomain routing.
 *
 * Each owner gets a workspace at <slug>.theruff.agency.
 * The same subdomain serves both the owner dashboard AND the client portal,
 * depending on path prefix:
 *
 *   <slug>.theruff.agency/             → owner dashboard (main app, no rewrite)
 *   <slug>.theruff.agency/join         → client signup (/portal/<slug>/signup)
 *   <slug>.theruff.agency/client-login → client login  (/portal/<slug>/login)
 *   <slug>.theruff.agency/client/*     → client portal (/portal/<slug>/*)
 *
 * Reserved subdomains bypass portal routing entirely and serve the main app.
 */

const RESERVED_SUBDOMAINS = new Set(['dashboard', 'www', 'app', 'api', 'admin'])

export function proxy(request: NextRequest) {
  const hostname   = request.headers.get('host') ?? ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

  if (!rootDomain) return NextResponse.next()

  // Only rewrite requests to <something>.theruff.agency
  const isWorkspaceSubdomain =
    hostname !== rootDomain &&
    hostname.endsWith(`.${rootDomain}`)

  if (!isWorkspaceSubdomain) return NextResponse.next()

  const slug = hostname.slice(0, hostname.length - rootDomain.length - 1)

  // admin.<root> serves the personal admin board at its root. Other paths pass
  // through (the board is also reachable path-based at /admin on any host).
  if (slug === 'admin') {
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // Reserved subdomains → main app, no rewrite
  if (RESERVED_SUBDOMAINS.has(slug)) return NextResponse.next()

  const url  = request.nextUrl.clone()
  const path = url.pathname

  // /join → client signup page
  if (path === '/join' || path === '/join/') {
    url.pathname = `/portal/${slug}/signup`
    return NextResponse.rewrite(url)
  }

  // /client-login → client login page
  if (path === '/client-login' || path === '/client-login/') {
    url.pathname = `/portal/${slug}/login`
    return NextResponse.rewrite(url)
  }

  // /client/* → client portal pages
  // e.g. /client/contracts → /portal/<slug>/contracts
  if (path.startsWith('/client/') || path === '/client') {
    const rest = path.slice('/client'.length) || '/'
    url.pathname = `/portal/${slug}${rest}`
    return NextResponse.rewrite(url)
  }

  // Everything else (/, /clients, /invoices, /settings, etc.) → owner dashboard
  // Pass the workspace slug as a header for server components that need it
  const res = NextResponse.next()
  res.headers.set('x-workspace-slug', slug)
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}

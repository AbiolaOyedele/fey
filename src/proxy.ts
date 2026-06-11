import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Subdomains that belong to the main app — never rewrite these to /portal/
const RESERVED_SUBDOMAINS = ['dashboard', 'www', 'app', 'api']

export function proxy(request: NextRequest) {
  const hostname   = request.headers.get('host') ?? ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

  if (!rootDomain) return NextResponse.next()

  // Extract the subdomain from the hostname
  // e.g. "abiola.theruff.agency" with rootDomain "theruff.agency" → "abiola"
  const isSubdomain = hostname !== rootDomain && hostname.endsWith(`.${rootDomain}`)
  if (!isSubdomain) return NextResponse.next()

  const subdomain = hostname.slice(0, hostname.length - rootDomain.length - 1)

  // Let reserved subdomains pass through to the main app as-is
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return NextResponse.next()

  // Rewrite portal subdomains: abiola.theruff.agency → /portal/abiola/...
  const url = request.nextUrl.clone()
  const originalPath = url.pathname
  url.pathname = `/portal/${subdomain}${originalPath === '/' ? '' : originalPath}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}

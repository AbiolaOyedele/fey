import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const hostname  = request.headers.get('host') ?? ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

  if (!rootDomain) return NextResponse.next()

  const isSubdomain =
    hostname !== rootDomain &&
    hostname !== `www.${rootDomain}` &&
    hostname.endsWith(`.${rootDomain}`)

  if (isSubdomain) {
    const subdomain = hostname.slice(0, hostname.length - rootDomain.length - 1)
    const url = request.nextUrl.clone()
    const originalPath = url.pathname
    url.pathname = `/portal/${subdomain}${originalPath === '/' ? '' : originalPath}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}

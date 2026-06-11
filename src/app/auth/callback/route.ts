import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/config/env'

/**
 * GET /auth/callback
 *
 * Handles the PKCE code exchange after Google (or any OAuth) sign-in.
 * Supabase redirects here with ?code=... after the user authenticates.
 * We exchange the code for a session, set the session cookies, then
 * redirect to /setup (new users) or / (returning users).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    // No code — redirect to login with an error param
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Successful sign-in — redirect to the intended destination
  return NextResponse.redirect(`${origin}${next}`)
}

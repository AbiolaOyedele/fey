import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

/**
 * Creates an authenticated Supabase client scoped to the user's session.
 * Pass the Bearer token from the Authorization header.
 */
export function createUserClient(token: string) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
}

/**
 * Creates a service-role client that bypasses RLS.
 * Only use in API routes after verifying ownership manually.
 * Never expose the service role key to the browser.
 */
export function createServiceClient() {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Extracts and verifies the Bearer token from an Authorization header.
 * Returns the user or throws an error string.
 */
export async function verifyToken(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null, token: null }
  const client = createUserClient(token)
  const { data: { user }, error } = await client.auth.getUser()
  if (error ?? !user) return { user: null, token: null }
  return { user, token }
}

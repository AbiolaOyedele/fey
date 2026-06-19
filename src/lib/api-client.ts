import { supabase } from '@/lib/supabase'

/**
 * Fetch wrapper for owner-app API routes. Injects the Supabase bearer token and
 * JSON headers, and throws a plain-English Error (message from the API's error
 * envelope) on non-2xx so callers can surface it directly.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init?.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Something went wrong. Please try again.')
  }
  return res.json() as Promise<T>
}

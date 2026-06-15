import { supabase } from '@/lib/supabase'
import { activeWorkspaceSlug } from '@/utils/host'

// Resolves the ACTIVE workspace for the signed-in user. The active workspace is
// the one whose slug matches the current subdomain (<slug>.theruff.agency); on
// localhost/apex it falls back to the user's first membership. Cache is keyed on
// (user, slug) so switching subdomains re-resolves.
interface ActiveWorkspace { ownerId: string; workspaceId: string | null }
let _cacheKey: string | null = null
let _cache: ActiveWorkspace | null = null

export async function resolveActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id ?? null
  if (!uid) return null

  const slug = activeWorkspaceSlug()
  const cacheKey = `${uid}:${slug ?? ''}`
  if (_cacheKey === cacheKey && _cache) return _cache

  const { data } = await supabase
    .from('workspace_members')
    .select('workspaces(id, slug, owner_id, created_at)')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })

  type WsRow = { id: string; slug: string | null; owner_id: string; created_at: string }
  const rows = ((data ?? []) as Array<{ workspaces: WsRow | WsRow[] | null }>)
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces))
    .filter((w): w is WsRow => !!w)

  const match = (slug ? rows.find((w) => w.slug === slug) : undefined) ?? rows[0]
  const result: ActiveWorkspace = { ownerId: match?.owner_id ?? uid, workspaceId: match?.id ?? null }
  _cacheKey = cacheKey
  _cache    = result
  return result
}

export async function getEffectiveOwnerId(): Promise<string | null> {
  return (await resolveActiveWorkspace())?.ownerId ?? null
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  return (await resolveActiveWorkspace())?.workspaceId ?? null
}

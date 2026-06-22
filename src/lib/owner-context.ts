import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves the effective workspace owner for a request. The client sends the
 * active workspace_id; with a user-scoped client, RLS only returns a workspace
 * the caller is a member of, so reading owner_id here is itself an access check.
 * Falls back to the user's own id (personal, workspace-less) when none is given
 * or resolvable.
 */
export async function resolveOwnerContext(
  db: SupabaseClient,
  userId: string,
  workspaceId: string | null | undefined,
): Promise<{ ownerId: string; workspaceId: string | null }> {
  if (workspaceId) {
    const { data } = await db.from('workspaces').select('owner_id').eq('id', workspaceId).maybeSingle()
    const ownerId = (data as { owner_id: string } | null)?.owner_id
    if (ownerId) return { ownerId, workspaceId }
  }
  return { ownerId: userId, workspaceId: null }
}

/**
 * True if `userId` is an owner/admin of any workspace owned by `ownerId`.
 * Pass a service-role client — this is an explicit permission check used before
 * service-role writes (so RLS can't silently no-op the write).
 */
export async function canManageOwner(db: SupabaseClient, userId: string, ownerId: string): Promise<boolean> {
  if (userId === ownerId) return true
  const { data } = await db
    .from('workspace_members')
    .select('role, workspaces!inner ( owner_id )')
    .eq('user_id', userId)
    .eq('workspaces.owner_id', ownerId)
    .in('role', ['owner', 'admin'])
    .limit(1)
  return !!(data && data.length > 0)
}

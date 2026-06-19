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

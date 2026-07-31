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
 * True if `userId` belongs to at least one workspace they do NOT own.
 *
 * Guards the personal-scope fallback above. That fallback makes `ownerId` equal
 * the caller's own id, which any "am I the owner?" check reads as yes — so a
 * request that simply omits workspace_id would otherwise promote a member to
 * owner of a phantom personal scope. Someone who is a member of another
 * person's workspace is never a solo user, so the fallback must not grant them
 * owner rights. Safe with a user-scoped client: RLS exposes only their own
 * membership rows.
 */
export async function isMemberOfForeignWorkspace(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db
    .from('workspace_members')
    .select('workspace_id, workspaces!inner ( owner_id )')
    .eq('user_id', userId)
  if (!data) return false
  return (data as unknown as { workspaces: { owner_id: string } | null }[])
    .some((row) => row.workspaces && row.workspaces.owner_id !== userId)
}

/**
 * True if `userId` may administer the Image Pipeline inside `ownerId`'s scope
 * without owning it: a super_admin, or an admin whose workspace grants the
 * `image_credits` capability. Mirrors app_has_capability() in RLS.
 */
export async function hasImageCreditsGrant(
  db: SupabaseClient,
  userId: string,
  ownerId: string,
): Promise<boolean> {
  if (userId === ownerId) return false // handled by the ownership path
  const { data } = await db
    .from('workspace_members')
    .select('role, workspaces!inner ( owner_id, admin_permissions )')
    .eq('user_id', userId)
    .eq('workspaces.owner_id', ownerId)
  if (!data) return false
  return (data as unknown as {
    role: string
    workspaces: { admin_permissions: unknown } | null
  }[]).some((row) => {
    if (row.role === 'owner' || row.role === 'super_admin') return true
    if (row.role !== 'admin') return false
    const caps = row.workspaces?.admin_permissions
    return Array.isArray(caps) && caps.includes('image_credits')
  })
}

/**
 * True if `userId` is an admin of the workspace(s) owned by `ownerId` — i.e. the
 * owner themselves, or a member with the owner/admin role. Safe to call with a
 * user-scoped client: RLS only exposes the caller's own membership rows, so a
 * member can never resolve themselves as admin of someone else's workspace.
 *
 * Used to widen task visibility: admins see every task in the workspace, while
 * members see only tasks that are theirs (created/assigned) or team-visible.
 */
export async function isWorkspaceAdmin(db: SupabaseClient, userId: string, ownerId: string): Promise<boolean> {
  // The owner is always an admin of their own tasks (incl. the workspace-less
  // solo case where ownerId falls back to the user's own id).
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

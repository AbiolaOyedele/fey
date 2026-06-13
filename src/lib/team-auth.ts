import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceRole } from '@/types/team'

/**
 * Returns the caller's role in a workspace, or null if they aren't a member.
 * Uses the service-role client so it can read membership regardless of RLS.
 */
export async function getMemberRole(
  db: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const { data } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as { role: WorkspaceRole } | null)?.role ?? null
}

/** Roles permitted to manage the team. */
export function isManager(role: WorkspaceRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/** Generates an unguessable invite token. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

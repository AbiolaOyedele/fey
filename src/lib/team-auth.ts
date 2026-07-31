import type { SupabaseClient } from '@supabase/supabase-js'
import { canManageTeam, hasCapability, type AdminCapability, type WorkspaceRole } from '@/types/team'

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

/**
 * Capabilities a workspace grants to its `admin` role. Empty when the workspace
 * is missing or grants nothing — failing closed is the right default here.
 */
export async function getWorkspaceCapabilities(
  db: SupabaseClient,
  workspaceId: string,
): Promise<AdminCapability[]> {
  const { data } = await db
    .from('workspaces')
    .select('admin_permissions')
    .eq('id', workspaceId)
    .maybeSingle()
  const raw = (data as { admin_permissions?: unknown } | null)?.admin_permissions
  return Array.isArray(raw) ? (raw as AdminCapability[]) : []
}

/**
 * Roles permitted to manage the team. owner/super_admin always; `admin` only
 * when the workspace grants the `team` capability, so pass `granted` from
 * getWorkspaceCapabilities — omitting it treats admin as restricted.
 */
export function isManager(role: WorkspaceRole | null, granted?: AdminCapability[] | null): boolean {
  return canManageTeam(role, granted)
}

/** Server-side capability check for a resolved role. */
export function roleHasCapability(
  role: WorkspaceRole | null,
  granted: AdminCapability[] | null,
  capability: AdminCapability,
): boolean {
  return hasCapability(role, granted, capability)
}

/** Generates an unguessable invite token. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

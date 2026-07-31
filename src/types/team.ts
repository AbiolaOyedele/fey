// Team workspaces, roles, invites, and internal chat (Playground).

export type WorkspaceRole = 'owner' | 'super_admin' | 'admin' | 'member'

/**
 * Capabilities an owner can grant to the `admin` role, per workspace.
 * owner and super_admin always hold all of them; member never does.
 * Mirrors the strings in workspaces.admin_permissions and app_has_capability().
 */
export type AdminCapability = 'finance' | 'contracts' | 'image_credits' | 'team'

export const ADMIN_CAPABILITIES: { key: AdminCapability; label: string; description: string }[] = [
  { key: 'finance',       label: 'Invoices & payments',       description: 'View and manage invoices, payment links and payouts' },
  { key: 'contracts',     label: 'Contracts & payment requests', description: 'View and manage client contracts and payment requests' },
  { key: 'image_credits', label: 'Image Pipeline credits',    description: 'Grant credits, set allocations and see generation costs' },
  { key: 'team',          label: 'Team & workspace settings', description: 'Invite people, change roles and edit workspace settings' },
]

export interface Workspace {
  id: string
  name: string
  slug: string | null
  owner_id: string
  created_at: string
  /** Capabilities this workspace grants to its `admin` role. Empty = restricted. */
  admin_permissions?: AdminCapability[]
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
  /** Resolved client-side from the member's auth profile (best-effort). */
  email?: string | null
  name?: string | null
}

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  email: string
  role: WorkspaceRole
  token: string
  invited_by: string
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  accepted_at: string | null
}

export interface InternalChannel {
  id: string
  workspace_id: string
  name: string
  created_by: string
  created_at: string
}

export interface InternalMessage {
  id: string
  channel_id: string
  workspace_id: string
  sender_id: string
  body: string
  attachments: import('./crm').MessageAttachment[]
  created_at: string
  edited_at: string | null
}

/** Role → human label + the permissions it grants on the team surface. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner:       'Owner',
  super_admin: 'Super admin',
  admin:       'Admin',
  member:      'Member',
}

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner:       'Full access to everything, including financial details. Cannot be changed.',
  super_admin: 'Full access to everything, including financial details.',
  admin:       'Oversight across the workspace. Financial and sensitive areas only if the owner grants them.',
  member:      'Works on their own tasks and the shared surfaces.',
}

/** Roles that always hold every capability, regardless of workspace settings. */
export function isUnrestrictedRole(role: WorkspaceRole | null | undefined): boolean {
  return role === 'owner' || role === 'super_admin'
}

/**
 * Whether `role` may exercise `capability` given the workspace's grants.
 * The authoritative check is app_has_capability() in RLS — this mirrors it so
 * the UI can hide what the database would refuse anyway.
 */
export function hasCapability(
  role: WorkspaceRole | null | undefined,
  granted: AdminCapability[] | null | undefined,
  capability: AdminCapability,
): boolean {
  if (isUnrestrictedRole(role)) return true
  if (role !== 'admin') return false
  return (granted ?? []).includes(capability)
}

/** Roles allowed to manage the team (invite, change roles, remove). */
export function canManageTeam(
  role: WorkspaceRole | null | undefined,
  granted?: AdminCapability[] | null,
): boolean {
  return hasCapability(role, granted, 'team')
}

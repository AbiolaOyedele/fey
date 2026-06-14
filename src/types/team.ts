// Team workspaces, roles, invites, and internal chat (Playground).

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Workspace {
  id: string
  name: string
  slug: string | null
  owner_id: string
  created_at: string
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
}

/** Role → human label + the permissions it grants on the team surface. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner:  'Owner',
  admin:  'Admin',
  member: 'Member',
}

/** Roles allowed to manage the team (invite, change roles, remove). */
export function canManageTeam(role: WorkspaceRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

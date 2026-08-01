import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { PORTAL_ROLES, canManagePortalMembers, type PortalRole, type PortalUser } from '@/types/crm'

/**
 * Portal member roles — who, on the CLIENT side, may do what.
 *
 * Two callers, one set of rules:
 *   • the client's own admin, from the portal's Members page
 *   • the workspace owner, from the CRM
 *
 * Both go through `setMemberRole`, so the invariants below hold no matter which
 * side made the change. Portal users aren't auth users, so none of this can be
 * expressed as RLS — the checks are here and callers pass a service-role client
 * after verifying their own identity.
 */

const SELECT = 'id, contact_id, owner_id, workspace_slug, name, email, avatar_url, role, can_sign, can_pay, created_at'

export async function listMembers(db: SupabaseClient, contactId: string): Promise<PortalUser[]> {
  const { data, error } = await db
    .from('portal_users')
    .select(SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PortalUser[]
}

const updateSchema = z.object({
  portal_user_id: z.string().uuid(),
  role: z.enum(PORTAL_ROLES).optional(),
  can_sign: z.boolean().optional(),
  can_pay: z.boolean().optional(),
})

interface Actor {
  /** 'owner' when the agency is making the change from the CRM. */
  kind: 'owner' | 'portal_user'
  /** The acting portal user's id — required when kind is 'portal_user'. */
  portalUserId?: string
}

/**
 * Changes one member's role and/or capabilities.
 *
 * Guards, in order:
 *   1. the target must belong to the contact being administered
 *   2. a portal user must be that contact's client_admin
 *   3. a client_admin cannot demote themselves while they're the only one —
 *      otherwise a contact ends up with nobody who can manage access, and only
 *      the agency could dig them out
 */
export async function setMemberRole(
  db: SupabaseClient,
  scope: { contactId: string; ownerId: string },
  actor: Actor,
  input: unknown,
): Promise<PortalUser> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, 'That role change isn’t valid.', 'PORTAL_MEMBER_INVALID')
  }
  const { portal_user_id, ...patch } = parsed.data
  if (Object.keys(patch).length === 0) {
    throw new AppError(400, 'Nothing to change.', 'PORTAL_MEMBER_INVALID')
  }

  const members = await listMembers(db, scope.contactId)
  const target = members.find((m) => m.id === portal_user_id)
  // Scoped lookup rather than a bare id read: this is what stops one client
  // editing another client's members by guessing an id.
  if (!target) {
    throw new AppError(404, 'That member could not be found.', 'PORTAL_MEMBER_NOT_FOUND')
  }
  if (target.owner_id !== scope.ownerId) {
    throw new AppError(404, 'That member could not be found.', 'PORTAL_MEMBER_NOT_FOUND')
  }

  if (actor.kind === 'portal_user') {
    const me = members.find((m) => m.id === actor.portalUserId)
    if (!me || !canManagePortalMembers(me.role)) {
      throw new AppError(403, 'Only a portal admin can change roles.', 'PORTAL_MEMBER_FORBIDDEN')
    }
    // Losing the last admin would leave the client unable to manage their own
    // access at all. The agency can still do it from the CRM.
    const isSelfDemotion = me.id === target.id && patch.role !== undefined && patch.role !== 'client_admin'
    if (isSelfDemotion && members.filter((m) => m.role === 'client_admin').length <= 1) {
      throw new AppError(
        409,
        'Make someone else an admin before changing your own role.',
        'PORTAL_MEMBER_LAST_ADMIN',
      )
    }
  }

  const { data, error } = await db
    .from('portal_users')
    .update(patch)
    .eq('id', portal_user_id)
    .eq('contact_id', scope.contactId)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as PortalUser
}

/** Convenience for gating UI and write paths on a capability. */
export function canSign(user: Pick<PortalUser, 'role' | 'can_sign'>): boolean {
  return user.role !== 'viewer' && user.can_sign
}

export function canPay(user: Pick<PortalUser, 'role' | 'can_pay'>): boolean {
  return user.role !== 'viewer' && user.can_pay
}

/** Read-only members can't write anything in the portal. */
export function isReadOnly(role: PortalRole): boolean {
  return role === 'viewer'
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import { escapeHtml } from '@/utils/escapeHtml'
import { sendEmail } from '@/services/email.service'
import { EMAIL_FROM, portalUrl } from '@/config/email'
import { mapPortalUser } from '@/repositories/portal.repository'
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

// password_hash is selected only so `pending` can be derived — mapPortalUser
// strips it before the row leaves this layer.
const SELECT = 'id, contact_id, owner_id, workspace_slug, name, email, avatar_url, role, can_sign, can_pay, created_at, revoked_at, revoked_by, password_hash'

export async function listMembers(db: SupabaseClient, contactId: string): Promise<PortalUser[]> {
  const { data, error } = await db
    .from('portal_users')
    .select(SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(mapPortalUser)
}

const inviteSchema = z.object({
  name:  z.string().min(1, 'Give them a name.').max(200).trim(),
  email: z.string().email('That email doesn’t look right.').toLowerCase(),
  role:  z.enum(PORTAL_ROLES).optional(),
})

/**
 * Adds someone from the client's own side, before they've ever signed in.
 *
 * The row is created with no password: they can't authenticate (login compares
 * against a dummy hash), and signup claims the row rather than rejecting the
 * email as taken. That keeps one identity per person per workspace instead of
 * the duplicate an invite-then-signup flow would otherwise create.
 *
 * Only a client_admin may do this, and only within their own contact.
 */
export async function invitePortalMember(
  db: SupabaseClient,
  scope: {
    contactId: string
    ownerId: string
    workspaceSlug: string
    /** The contact's short invite code — needed to build the signup link. */
    inviteCode?: string | null
    /** Who added them, for the email. */
    inviterName?: string
  },
  actor: Actor,
  input: unknown,
): Promise<PortalUser> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Those details aren’t valid.', 'PORTAL_MEMBER_INVALID')
  }
  const { name, email, role } = parsed.data

  const members = await listMembers(db, scope.contactId)

  if (actor.kind === 'portal_user') {
    const me = members.find((m) => m.id === actor.portalUserId)
    if (!me || !canManagePortalMembers(me.role)) {
      throw new AppError(403, 'Only a portal admin can add people.', 'PORTAL_MEMBER_FORBIDDEN')
    }
  }

  // Uniqueness is per workspace, not per contact — the same email can't hold two
  // logins in one workspace even under different clients.
  const { data: clash } = await db
    .from('portal_users')
    .select('id')
    .eq('workspace_slug', scope.workspaceSlug)
    .eq('email', email)
    .maybeSingle()
  if (clash) {
    throw new AppError(409, 'Someone with that email already has access.', 'PORTAL_MEMBER_EMAIL_TAKEN')
  }

  const { data, error } = await db
    .from('portal_users')
    .insert({
      contact_id:     scope.contactId,
      owner_id:       scope.ownerId,
      workspace_slug: scope.workspaceSlug,
      name,
      email,
      password_hash:  null,
      avatar_url:     null,
      role:           role ?? 'collaborator',
      invited_by:     actor.kind === 'portal_user' ? actor.portalUserId ?? null : null,
      invited_at:     new Date().toISOString(),
    })
    .select(SELECT)
    .single()
  if (error) throw error
  const member = mapPortalUser(data as Record<string, unknown>)

  // Email them the join link. Best-effort: `sendEmail` never throws, and the
  // person exists in the portal either way — an invite that didn't send is a
  // nuisance, an invite that rolled back the whole add would be worse. The
  // invited-by name is included so the recipient knows why they got this.
  void sendInviteEmail({
    to: email,
    name,
    inviterName: scope.inviterName,
    inviteCode: scope.inviteCode,
    workspaceSlug: scope.workspaceSlug,
  })

  return member
}

interface InviteEmailArgs {
  to: string
  name: string
  inviterName: string | undefined
  inviteCode: string | null | undefined
  workspaceSlug: string
}

async function sendInviteEmail(args: InviteEmailArgs): Promise<void> {
  // Without the contact's invite code there's no way to complete signup, so
  // there's nothing useful to send — the adder gets told to share the link.
  if (!args.inviteCode) return

  const url = portalUrl(args.workspaceSlug, `signup?code=${encodeURIComponent(args.inviteCode)}`)
  // Names are user-supplied — escape before they go anywhere near email HTML.
  const safeName = escapeHtml(args.name)
  const safeInviter = args.inviterName ? escapeHtml(args.inviterName) : null

  await sendEmail({
    from: EMAIL_FROM.portal,
    to: [args.to],
    subject: 'You’ve been added to a client portal',
    html: `<p>Hi ${safeName},</p>
           <p>${safeInviter ? `${safeInviter} has` : 'You’ve been'} given you access to your team’s client portal.</p>
           <p><a href="${url}">Set your password and sign in</a></p>
           <p>If you weren’t expecting this, you can ignore this email — the account can’t be used until a password is set.</p>`,
  })
}

/**
 * Resolves the target and the caller, and proves the caller is allowed to
 * administer them. Shared by every write below so the fence can't be forgotten
 * on one path and remembered on another.
 *
 * `verb` only shapes the error message — the rule is identical either way.
 */
async function resolveForAdmin(
  db: SupabaseClient,
  scope: { contactId: string },
  actor: Actor,
  portalUserId: string,
  verb: string,
): Promise<{ members: PortalUser[]; target: PortalUser; me: PortalUser | null }> {
  const members = await listMembers(db, scope.contactId)
  const target = members.find((m) => m.id === portalUserId)
  if (!target) {
    throw new AppError(404, 'That member could not be found.', 'PORTAL_MEMBER_NOT_FOUND')
  }

  let me: PortalUser | null = null
  if (actor.kind === 'portal_user') {
    me = members.find((m) => m.id === actor.portalUserId) ?? null
    if (!me || !canManagePortalMembers(me.role)) {
      throw new AppError(403, `Only a portal admin can ${verb} people.`, 'PORTAL_MEMBER_FORBIDDEN')
    }
    if (me.id === target.id) {
      throw new AppError(409, 'You can’t change your own access.', 'PORTAL_MEMBER_SELF_REMOVE')
    }
  }
  return { members, target, me }
}

/**
 * Would this leave the client with nobody who can manage their own access?
 *
 * Only asked of client-side callers. The agency can always dig a client out
 * from the CRM, so it is not blocked from doing this — but a client removing
 * their last admin would have no way back except asking the agency.
 */
function assertNotLastAdmin(members: PortalUser[], target: PortalUser): void {
  if (target.role !== 'client_admin') return
  const otherActiveAdmins = members.filter(
    (m) => m.id !== target.id && m.role === 'client_admin' && !m.revoked_at,
  )
  if (otherActiveAdmins.length === 0) {
    throw new AppError(
      409,
      'Make someone else an admin first — this is the only one left.',
      'PORTAL_MEMBER_LAST_ADMIN',
    )
  }
}

/**
 * Turns access off, or back on.
 *
 * The reversible half of removal, and the one that should be reached for first:
 * the person stops being able to reach anything the moment this lands, but
 * their messages, uploads and comments stay attached to a real name and they
 * can be let back in without being re-invited.
 *
 * Enforcement is not here — it's in `requirePortalAuth`, which re-reads this
 * column on every portal request. Setting it is all that's needed.
 */
export async function setMemberAccess(
  db: SupabaseClient,
  scope: { contactId: string },
  actor: Actor,
  portalUserId: string,
  revoked: boolean,
): Promise<PortalUser> {
  const { members, target, me } = await resolveForAdmin(
    db, scope, actor, portalUserId, revoked ? 'revoke' : 'restore',
  )

  if (revoked && actor.kind === 'portal_user') {
    assertNotLastAdmin(members, target)
  }

  const patch = revoked
    ? { revoked_at: new Date().toISOString(), revoked_by: me ? me.name : 'the agency' }
    : { revoked_at: null, revoked_by: null }

  const { data, error } = await db
    .from('portal_users')
    .update(patch)
    .eq('id', portalUserId)
    .eq('contact_id', scope.contactId)
    .select(SELECT)
    .single()
  if (error) throw error
  return mapPortalUser(data as Record<string, unknown>)
}

/**
 * Deletes the row outright. A client_admin can't delete themselves.
 *
 * Unlike `setMemberAccess` this can't be undone: the person is gone, and their
 * team-chat messages survive only as "Removed member" (the sender FK is
 * ON DELETE SET NULL for exactly that reason). Prefer revoking.
 */
export async function removeMember(
  db: SupabaseClient,
  scope: { contactId: string },
  actor: Actor,
  portalUserId: string,
): Promise<void> {
  const { members, target } = await resolveForAdmin(db, scope, actor, portalUserId, 'remove')

  if (actor.kind === 'portal_user') {
    assertNotLastAdmin(members, target)
  }

  const { error } = await db
    .from('portal_users')
    .delete()
    .eq('id', portalUserId)
    .eq('contact_id', scope.contactId)
  if (error) throw error
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
    // Revoked admins don't count — they can't act, so leaving only those behind
    // is the same as leaving nobody.
    if (isSelfDemotion && members.filter((m) => m.role === 'client_admin' && !m.revoked_at).length <= 1) {
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
  return mapPortalUser(data as Record<string, unknown>)
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

/** What a portal write path can require of its caller. */
export type PortalCapability = 'write' | 'sign' | 'pay'

const CAPABILITY_MESSAGE: Record<PortalCapability, string> = {
  write: 'Your access is view-only, so you can’t make changes.',
  sign:  'You don’t have permission to sign on behalf of your team.',
  pay:   'You don’t have permission to make payments for your team.',
}

/**
 * Server-side capability gate for portal write endpoints.
 *
 * The UI hides what someone can't do, but hiding a button is not a control —
 * every write path has to check for itself, or a viewer can simply call the API.
 * The role is read fresh from the database rather than taken from the JWT: a
 * portal admin may have demoted this person since their token was issued, and a
 * 30-day token would otherwise keep the old permissions alive that whole time.
 *
 * Returns the caller so routes that need their name or id don't fetch twice.
 */
export async function requireCapability(
  db: SupabaseClient,
  portalUserId: string,
  capability: PortalCapability,
): Promise<PortalUser> {
  const { data, error } = await db
    .from('portal_users')
    .select(SELECT)
    .eq('id', portalUserId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new AppError(403, 'Portal access not found.', 'PORTAL_USER_NOT_FOUND')
  }
  const user = mapPortalUser(data as Record<string, unknown>)

  // requirePortalAuth already turns revoked callers away, so reaching here
  // means something bypassed it. Cheap to re-check, and this is the last gate
  // before a write.
  if (user.revoked_at) {
    throw new AppError(403, 'Your access to this portal has been turned off.', 'PORTAL_ACCESS_REVOKED')
  }

  const allowed =
    capability === 'sign' ? canSign(user)
    : capability === 'pay' ? canPay(user)
    : !isReadOnly(user.role)

  if (!allowed) {
    throw new AppError(403, CAPABILITY_MESSAGE[capability], `PORTAL_${capability.toUpperCase()}_FORBIDDEN`)
  }
  return user
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientTeamMember } from '@/types/crm'

/**
 * Which of the agency's people a given client may see and assign work to.
 *
 * Opt-in by design: no rows means the client sees nobody. Enabling a portal
 * therefore never leaks the roster — the owner chooses, per client, who becomes
 * visible. The portal reads this through the service role (portal users aren't
 * auth users, so RLS can't authorise them), which is exactly why the read is
 * always scoped by a contact_id taken from the verified token.
 */

interface MemberRow {
  user_id: string
  name: string | null
  email: string | null
}

/** Every member of the owner's workspaces, for the owner-side picker. */
export async function listWorkspaceMembers(
  db: SupabaseClient,
  ownerId: string,
): Promise<MemberRow[]> {
  const { data, error } = await db
    .from('workspace_members')
    .select('user_id, name, email, workspaces!inner ( owner_id )')
    .eq('workspaces.owner_id', ownerId)
  if (error) throw error
  const seen = new Set<string>()
  const out: MemberRow[] = []
  for (const r of (data ?? []) as MemberRow[]) {
    if (seen.has(r.user_id)) continue
    seen.add(r.user_id)
    out.push({ user_id: r.user_id, name: r.name, email: r.email })
  }
  return out
}

/** The user_ids a client has been granted sight of. */
export async function listAccessUserIds(
  db: SupabaseClient,
  contactId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('client_team_access')
    .select('user_id')
    .eq('contact_id', contactId)
  if (error) throw error
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id)
}

/**
 * The people a client may see, with display names resolved.
 * Email is deliberately not returned — the client picks a person, they don't
 * need a way to contact them outside the portal.
 */
export async function listVisibleMembers(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<ClientTeamMember[]> {
  const [allowed, members] = await Promise.all([
    listAccessUserIds(db, contactId),
    listWorkspaceMembers(db, ownerId),
  ])
  const allowedSet = new Set(allowed)
  return members
    .filter((m) => allowedSet.has(m.user_id))
    // A member with neither name nor email would render as an empty row; fall
    // back to something a human can at least act on.
    .map((m) => ({ user_id: m.user_id, name: m.name ?? m.email ?? 'Team member' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Same list as a lookup map, for enriching task assignees. */
export async function visibleMemberMap(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<Map<string, string>> {
  const list = await listVisibleMembers(db, contactId, ownerId)
  return new Map(list.map((m) => [m.user_id, m.name]))
}

/**
 * Replaces the whole access list for a client.
 *
 * Delete-then-insert rather than a diff: the list is small, the write is rare,
 * and this keeps "what the owner ticked" and "what's stored" trivially equal.
 */
export async function setAccess(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
  userIds: string[],
): Promise<void> {
  const { error: delError } = await db
    .from('client_team_access')
    .delete()
    .eq('contact_id', contactId)
  if (delError) throw delError

  if (userIds.length === 0) return

  const { error } = await db
    .from('client_team_access')
    .insert(userIds.map((user_id) => ({ contact_id: contactId, user_id, owner_id: ownerId })))
  if (error) throw error
}

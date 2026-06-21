import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError, errorResponse } from '@/lib/api-helpers'
import { sendInviteAccepted } from '@/services/email.service'
import type { SupabaseClient } from '@supabase/supabase-js'

const bodySchema = z.object({
  token:    z.string().min(8),
  name:     z.string().trim().min(1).max(80),
  password: z.string().min(8).max(128),
})

/**
 * POST /api/v1/team/invites/accept
 *
 * Token-gated (no prior session needed). Possession of the invite token plus the
 * email it was issued to authorizes creating the teammate's account. We create
 * (or repair) the Supabase auth user server-side with the service role —
 * email auto-confirmed, password set — so the teammate can sign in immediately.
 * This works regardless of the project's email-confirmation setting.
 */
export async function POST(req: NextRequest) {
  let token: string, name: string, password: string
  try {
    const parsed = bodySchema.parse(await req.json())
    token = parsed.token; name = parsed.name; password = parsed.password
  } catch {
    return errorResponse('TEAM_ACCEPT_INVALID_INPUT', 'Enter your name and a password (8+ characters).', 400)
  }

  try {
    const db = createServiceClient()

    const { data: invite } = await db
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, invited_by')
      .eq('token', token)
      .maybeSingle()

    const inv = invite as {
      id: string; workspace_id: string; email: string
      role: 'admin' | 'member'; status: string; invited_by: string
    } | null

    if (!inv || inv.status !== 'pending') {
      return errorResponse('TEAM_ACCEPT_INVALID', 'This invite is no longer valid.', 404)
    }
    const email = inv.email.toLowerCase()

    // Create the auth user (auto-confirmed). If they already exist (e.g. a prior
    // failed attempt), reset their password and confirm them so they're usable.
    let userId: string
    const created = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })
    if (created.data?.user) {
      userId = created.data.user.id
    } else {
      const existingId = await findUserIdByEmail(db, email)
      if (!existingId) {
        return errorResponse('TEAM_ACCEPT_ACCOUNT_FAILED', created.error?.message ?? 'Could not set up your account.', 400)
      }
      await db.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      })
      userId = existingId
    }

    // Join the workspace.
    const { error: memberErr } = await db.from('workspace_members').upsert(
      { workspace_id: inv.workspace_id, user_id: userId, role: inv.role, email, name },
      { onConflict: 'workspace_id,user_id' },
    )
    if (memberErr) throw memberErr

    await db.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv.id)

    // Best-effort: tell the inviter (never throws).
    const [{ data: inviter }, { data: ws }] = await Promise.all([
      db.from('workspace_members').select('email').eq('workspace_id', inv.workspace_id).eq('user_id', inv.invited_by).maybeSingle(),
      db.from('workspaces').select('name').eq('id', inv.workspace_id).maybeSingle(),
    ])
    const inviterEmail = (inviter as { email: string | null } | null)?.email
    if (inviterEmail) {
      await sendInviteAccepted(inviterEmail, { memberName: name, workspaceName: (ws as { name: string } | null)?.name ?? 'your workspace' })
    }

    // Mint a one-time login token so the client gets a session immediately on
    // click — no password round-trip (which can flake on timing/confirmation).
    let tokenHash: string | null = null
    try {
      const { data: link } = await db.auth.admin.generateLink({ type: 'magiclink', email })
      tokenHash = (link?.properties as { hashed_token?: string } | undefined)?.hashed_token ?? null
    } catch { /* client falls back to password sign-in */ }

    return NextResponse.json({ ok: true, email, token_hash: tokenHash })
  } catch (err) {
    return handleError(err, 'TEAM_ACCEPT_FAILED')
  }
}

/** Find an existing auth user id by email (paginated admin lookup). */
async function findUserIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (match) return match.id
    if (data.users.length < 200) return null
  }
  return null
}

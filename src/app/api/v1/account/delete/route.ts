import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/v1/account/delete
 * Permanently deletes the authenticated user's account and ALL of their data,
 * then removes the auth user itself so the account can't log back in with stale
 * data. Runs with the service role. Best-effort per table — a missing table or
 * row never aborts the whole wipe.
 */

/** Delete rows in `table` where `column` = value. Never throws. */
async function wipe(db: SupabaseClient, table: string, column: string, value: string): Promise<void> {
  try { await db.from(table).delete().eq(column, value) } catch { /* best-effort */ }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const uid = user!.id

  try {
    const db = createServiceClient()

    // 1. Workspaces this user OWNS — cascade removes members, invites, and the
    //    internal channels/messages tied to them.
    await wipe(db, 'workspaces', 'owner_id', uid)
    // 2. Memberships in OTHER people's workspaces (remove this user from teams).
    await wipe(db, 'workspace_members', 'user_id', uid)

    // 3. CRM data — deleting contacts cascades messages/files/contracts/forms.
    await wipe(db, 'crm_contacts',         'owner_id', uid)
    await wipe(db, 'crm_payment_requests', 'owner_id', uid)
    await wipe(db, 'crm_notifications',     'owner_id', uid)
    await wipe(db, 'crm_templates',         'user_id',  uid)
    await wipe(db, 'portal_users',          'owner_id', uid)

    // 4. Invoices + legacy Fey data.
    await wipe(db, 'invoices',          'user_id', uid)
    await wipe(db, 'tasks',             'user_id', uid)
    await wipe(db, 'retainer_payments', 'user_id', uid)
    await wipe(db, 'standalone_tasks',  'user_id', uid)
    await wipe(db, 'task_groups',       'user_id', uid)
    // New unified task system — work_subtasks/assignees cascade from work_tasks,
    // workflow_stages cascade from workflows.
    await wipe(db, 'work_tasks',        'owner_id', uid)
    await wipe(db, 'workflows',         'owner_id', uid)
    await wipe(db, 'shared_clients',    'user_id', uid)
    await wipe(db, 'clients',           'user_id', uid)
    await wipe(db, 'trash',             'user_id', uid)

    // 5. Settings last (it's the onboarding/identity anchor).
    await wipe(db, 'fey_settings', 'user_id', uid)

    // 6. Finally remove the auth user so the login can't resurrect stale state.
    try { await db.auth.admin.deleteUser(uid) } catch { /* non-fatal — data is gone */ }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err, 'ACCOUNT_DELETE_FAILED')
  }
}

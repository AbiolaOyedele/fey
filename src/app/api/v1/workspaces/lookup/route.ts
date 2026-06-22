import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'
import { handleError, errorResponse } from '@/lib/api-helpers'

const bodySchema = z.object({ email: z.string().email() })

/**
 * POST /api/v1/workspaces/lookup  { email }
 * Returns the workspaces a given email can access (by workspace_members.email),
 * so a user can pick which one to sign into. Public — returns name + slug only,
 * which are already exposed via the subdomain. Service role (RLS would hide
 * other accounts' memberships).
 */
export async function POST(req: NextRequest) {
  let email: string
  try { email = bodySchema.parse(await req.json()).email.toLowerCase() } catch {
    return errorResponse('WORKSPACE_LOOKUP_INVALID', 'Enter a valid email address.', 400)
  }

  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('workspace_members')
      .select('role, workspaces ( name, slug )')
      .ilike('email', email)
    if (error) throw error

    const seen = new Set<string>()
    const workspaces: Array<{ name: string; slug: string; role: string }> = []
    for (const row of (data ?? []) as Array<{ role: string; workspaces: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null }>) {
      const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
      if (!ws?.slug || seen.has(ws.slug)) continue
      seen.add(ws.slug)
      workspaces.push({ name: ws.name, slug: ws.slug, role: row.role })
    }
    return NextResponse.json({ workspaces })
  } catch (err) {
    return handleError(err, 'WORKSPACE_LOOKUP_FAILED')
  }
}

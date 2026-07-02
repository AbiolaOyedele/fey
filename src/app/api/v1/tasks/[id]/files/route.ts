import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { addTaskFile } from '@/services/work-tasks.service'

/**
 * POST /api/v1/tasks/:id/files
 * Records a Cloudinary upload against a task. The binary was already uploaded
 * direct to Cloudinary (signed via /api/v1/uploads/sign); this stores metadata.
 * Body: { file_name, file_url, public_id, file_size?, file_type? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'TASK_FILE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    // Display name for "uploaded by" — the member's saved name, else email prefix.
    const { data: member } = await db
      .from('workspace_members')
      .select('name')
      .eq('user_id', user!.id)
      .limit(1)
      .maybeSingle()
    const name = (member as { name: string | null } | null)?.name
      ?? (user!.email ?? '').split('@')[0]
      ?? null

    const file = await addTaskFile(db, id, body, { userId: user!.id, name })
    return NextResponse.json({ file }, { status: 201 })
  } catch (err) {
    return handleError(err, 'TASK_FILE_CREATE_FAILED')
  }
}

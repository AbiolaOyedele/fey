import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import { listPostFiles, addPostFile } from '@/services/social.service'

/** GET /api/v1/social/posts/:id/files */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response

  const db = createUserClient(token!)
  try {
    const files = await listPostFiles(db, id)
    return NextResponse.json({ files })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_FILES_LIST_FAILED')
  }
}

/**
 * POST /api/v1/social/posts/:id/files
 * Records a Cloudinary upload against a post. The binary was already uploaded
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
    return NextResponse.json({ error: { code: 'SOCIAL_POST_FILE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }

  const db = createUserClient(token!)
  try {
    const { data: member } = await db
      .from('workspace_members')
      .select('name')
      .eq('user_id', user!.id)
      .limit(1)
      .maybeSingle()
    const name = (member as { name: string | null } | null)?.name
      ?? (user!.email ?? '').split('@')[0]
      ?? null

    const file = await addPostFile(db, id, body, { userId: user!.id, name })
    return NextResponse.json({ file }, { status: 201 })
  } catch (err) {
    return handleError(err, 'SOCIAL_POST_FILE_CREATE_FAILED')
  }
}

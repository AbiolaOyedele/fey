import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, handleError } from '@/lib/api-helpers'
import * as crmService from '@/services/crm.service'
import { z } from 'zod'
import type { CrmFile } from '@/types/crm'

const fileSchema = z.object({
  contact_id:    z.string().uuid(),
  file_name:     z.string().min(1).max(500),
  file_url:      z.string().url(),
  public_id:     z.string().min(1).max(500),
  file_size:     z.number().int().nonnegative().nullable().optional(),
  file_type:     z.string().max(100).nullable().optional(),
  uploader_type: z.enum(['owner', 'client']),
})

/**
 * GET /api/v1/crm/files?contact_id=...
 */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: { code: 'CRM_FILES_MISSING_CONTACT', message: 'contact_id is required.' } }, { status: 400 })
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  const db = createUserClient(token!)
  try {
    const files = await crmService.getFiles(db, contactId, user!.id)
    return NextResponse.json({ files })
  } catch (err) {
    return handleError(err, 'CRM_FILES_GET_FAILED')
  }
}

/**
 * DELETE /api/v1/crm/files
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_FILE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'CRM_FILE_VALIDATION_ERROR', message: 'File id is required.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    await crmService.removeFile(db, parsed.data.id, user!.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err, 'CRM_FILE_DELETE_FAILED')
  }
}

/**
 * POST /api/v1/crm/files
 * Body: { contact_id, file_name, file_url, public_id, file_size?, file_type?, uploader_type }
 */
export async function POST(req: NextRequest) {
  const { user, token, response } = await requireAuth(req.headers.get('authorization'))
  if (response) return response
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'CRM_FILE_INVALID_BODY', message: 'Invalid request body.' } }, { status: 400 })
  }
  const parsed = fileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'CRM_FILE_VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } }, { status: 400 })
  }
  const db = createUserClient(token!)
  try {
    const file = await crmService.addFile(
      db,
      user!.id,
      user!.id,
      parsed.data as Omit<CrmFile, 'id' | 'created_at' | 'owner_id' | 'uploaded_by'>,
    )
    return NextResponse.json({ file }, { status: 201 })
  } catch (err) {
    return handleError(err, 'CRM_FILE_CREATE_FAILED')
  }
}

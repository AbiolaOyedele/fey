import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AppError } from '@/lib/errors'
import type { PortalTokenPayload } from '@/lib/portal-jwt'
import * as repo from '@/repositories/portal-projects.repository'
import type { Project, ProjectMessage, ProjectFile } from '@/types/project'
import type { MessageAttachment } from '@/types/crm'

const attachmentSchema = z.object({
  file_name: z.string(),
  file_url: z.string().url(),
  file_type: z.string(),
  file_size: z.number(),
})

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message can’t be empty.').max(10000),
  body_html: z.string().max(50000).optional().nullable(),
  attachments: z.array(attachmentSchema).max(20).optional(),
})

const addFileSchema = z.object({
  file_name: z.string().min(1).max(500),
  file_url: z.string().url(),
  public_id: z.string().max(500).optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  file_type: z.string().max(200).optional().nullable(),
})

/** Lists the portal user's (non-archived) projects. */
export function listProjects(db: SupabaseClient, p: PortalTokenPayload): Promise<Project[]> {
  return repo.listProjectsForContact(db, p.contact_id, p.owner_id)
}

/** Loads one project + its messages + files, after an ownership check. */
export async function getProjectDetail(
  db: SupabaseClient,
  p: PortalTokenPayload,
  projectId: string,
): Promise<{ project: Project; messages: ProjectMessage[]; files: ProjectFile[] }> {
  const project = await repo.getProjectForPortal(db, projectId, p.contact_id, p.owner_id)
  if (!project) throw new AppError(404, 'Project not found.', 'PORTAL_PROJECT_NOT_FOUND')
  // Opening the thread marks the owner's messages read (so the owner sees receipts).
  await repo.markOwnerProjectMessagesRead(db, projectId).catch(() => { /* best-effort */ })
  const [messages, files] = await Promise.all([
    repo.listProjectMessages(db, projectId),
    repo.listProjectFiles(db, projectId),
  ])
  return { project, messages, files }
}

export async function sendMessage(
  db: SupabaseClient,
  p: PortalTokenPayload,
  projectId: string,
  input: unknown,
): Promise<ProjectMessage> {
  const project = await repo.getProjectForPortal(db, projectId, p.contact_id, p.owner_id)
  if (!project) throw new AppError(404, 'Project not found.', 'PORTAL_PROJECT_NOT_FOUND')
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid message.', 'PORTAL_PROJECT_MSG_INVALID')
  }
  return repo.createProjectMessage(db, {
    projectId,
    ownerId: p.owner_id,
    senderId: p.portal_user_id,
    workspaceId: project.workspace_id,
    body: parsed.data.body,
    bodyHtml: parsed.data.body_html ?? null,
    attachments: (parsed.data.attachments ?? []) as MessageAttachment[],
  })
}

export async function addFile(
  db: SupabaseClient,
  p: PortalTokenPayload,
  projectId: string,
  input: unknown,
): Promise<ProjectFile> {
  const project = await repo.getProjectForPortal(db, projectId, p.contact_id, p.owner_id)
  if (!project) throw new AppError(404, 'Project not found.', 'PORTAL_PROJECT_NOT_FOUND')
  const parsed = addFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid file.', 'PORTAL_PROJECT_FILE_INVALID')
  }
  return repo.createProjectFile(db, {
    projectId,
    ownerId: p.owner_id,
    workspaceId: project.workspace_id,
    fileName: parsed.data.file_name,
    fileUrl: parsed.data.file_url,
    publicId: parsed.data.public_id ?? null,
    fileSize: parsed.data.file_size ?? null,
    fileType: parsed.data.file_type ?? null,
  })
}

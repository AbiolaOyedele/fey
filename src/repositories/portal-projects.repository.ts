import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project, ProjectMessage, ProjectFile } from '@/types/project'
import type { MessageAttachment } from '@/types/crm'

/**
 * Portal-side project queries. Always called with a service-role client AFTER
 * the route verifies the portal JWT. Every read/write is scoped to the portal
 * user's contact_id + owner_id so a client can only ever touch their own
 * projects. Archived projects are hidden from clients.
 */

export async function listProjectsForContact(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Project[]
}

/** Returns the project only if it belongs to this contact + owner and isn't archived. */
export async function getProjectForPortal(
  db: SupabaseClient,
  projectId: string,
  contactId: string,
  ownerId: string,
): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as Project | null) ?? null
}

export async function listProjectMessages(
  db: SupabaseClient,
  projectId: string,
): Promise<ProjectMessage[]> {
  const { data, error } = await db
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProjectMessage[]
}

export async function createProjectMessage(
  db: SupabaseClient,
  args: { projectId: string; ownerId: string; senderId: string; workspaceId: string | null; body: string; bodyHtml: string | null; attachments: MessageAttachment[] },
): Promise<ProjectMessage> {
  const { data, error } = await db
    .from('project_messages')
    .insert({
      project_id:   args.projectId,
      owner_id:     args.ownerId,
      workspace_id: args.workspaceId,
      sender_type:  'client',
      sender_id:    args.senderId,
      body:         args.body,
      body_html:    args.bodyHtml,
      attachments:  args.attachments,
    })
    .select()
    .single()
  if (error) throw error
  return data as ProjectMessage
}

export async function listProjectFiles(
  db: SupabaseClient,
  projectId: string,
): Promise<ProjectFile[]> {
  const { data, error } = await db
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjectFile[]
}

export async function createProjectFile(
  db: SupabaseClient,
  args: { projectId: string; ownerId: string; workspaceId: string | null; fileName: string; fileUrl: string; publicId: string | null; fileSize: number | null; fileType: string | null },
): Promise<ProjectFile> {
  const { data, error } = await db
    .from('project_files')
    .insert({
      project_id:    args.projectId,
      owner_id:      args.ownerId,
      workspace_id:  args.workspaceId,
      uploader_type: 'client',
      file_name:     args.fileName,
      file_url:      args.fileUrl,
      public_id:     args.publicId,
      file_size:     args.fileSize,
      file_type:     args.fileType,
    })
    .select()
    .single()
  if (error) throw error
  return data as ProjectFile
}

/** Mark the owner's messages in a project as read (client opened the thread). */
export async function markOwnerProjectMessagesRead(
  db: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { error } = await db
    .from('project_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('sender_type', 'owner')
    .is('read_at', null)
  if (error) throw error
}

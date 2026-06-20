import type { MessageAttachment } from '@/types/crm'

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'

export interface Project {
  id: string
  owner_id: string
  workspace_id: string | null
  /** null = personal project (not assigned to a client; never shown in a portal). */
  contact_id: string | null
  title: string
  description: string | null
  status: ProjectStatus
  start_date: string | null
  due_date: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateProjectPayload {
  contact_id: string | null
  title: string
  description?: string | null
  status?: ProjectStatus
  start_date?: string | null
  due_date?: string | null
}

export interface UpdateProjectPayload {
  title?: string
  description?: string | null
  status?: ProjectStatus
  start_date?: string | null
  due_date?: string | null
  archived_at?: string | null
}

export interface ProjectMessage {
  id: string
  project_id: string
  owner_id: string
  sender_type: 'owner' | 'client'
  sender_id: string
  body: string
  body_html: string | null
  attachments: MessageAttachment[]
  read_at: string | null
  created_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  owner_id: string
  uploader_type: 'owner' | 'client'
  file_name: string
  file_url: string
  public_id: string | null
  file_size: number | null
  file_type: string | null
  created_at: string
}

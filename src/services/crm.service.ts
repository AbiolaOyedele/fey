import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import * as repo from '@/repositories/crm.repository'
import { destroyCloudinaryAsset } from '@/lib/cloudinary-server'
import { createServiceClient } from '@/lib/supabase-server'
import { notifyClient } from './portal-notifications.service'
import type {
  CrmContact,
  CrmMessage,
  CrmFile,
  CrmContract,
  CrmForm,
  CrmNotification,
  CreateContactPayload,
  UpdateContactPayload,
  CreateMessagePayload,
  CreateContractPayload,
  UpdateContractPayload,
  CreateFormPayload,
  UpdateFormPayload,
} from '@/types/crm'
import { z } from 'zod'

/**
 * Tells the client something arrived for them.
 *
 * Portal notifications live on their own table with their own recipient
 * (portal users aren't auth users), and RLS has no client-facing insert policy
 * — so this needs the service role regardless of which client the caller
 * handed us. Created here rather than threaded through every route, and
 * `notifyClient` already swallows its own failures: telling the client must
 * never fail the owner's action.
 */
function announceToClient(args: Omit<Parameters<typeof notifyClient>[0], 'db'>): void {
  void notifyClient({ db: createServiceClient(), ...args })
}

// ── Validation schemas ────────────────────────────────────────────────────────

const createContactSchema = z.object({
  name:    z.string().min(1).max(200),
  email:   z.string().email().optional().nullable(),
  phone:   z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  status:  z.enum(['active', 'idle', 'completed']).optional(),
})

const updateContactSchema = z.object({
  name:                    z.string().min(1).max(200).optional(),
  email:                   z.string().email().optional().nullable(),
  phone:                   z.string().max(50).optional().nullable(),
  company:                 z.string().max(200).optional().nullable(),
  status:                  z.enum(['active', 'idle', 'completed']).optional(),
  portal_enabled:          z.boolean().optional(),
  portal_welcome_message:  z.string().max(2000).optional().nullable(),
})

const createMessageSchema = z.object({
  contact_id:  z.string().uuid(),
  body:        z.string().min(1).max(20_000),
  body_html:   z.string().max(50_000).optional().nullable(),
  attachments: z.array(z.object({
    file_name: z.string().max(500),
    file_url:  z.string().url(),
    file_type: z.string().max(100),
    file_size: z.number().int().nonnegative(),
  })).optional(),
})

const createContractSchema = z.object({
  contact_id: z.string().uuid(),
  title:      z.string().min(1).max(300),
})

const updateContractSchema = z.object({
  title:   z.string().min(1).max(300).optional(),
  content: z.object({
    body:            z.string().optional(),
    body_html:       z.string().optional(),
    effective_date:  z.string().nullable().optional(),
    expiry_date:     z.string().nullable().optional(),
    signature_block: z.string().optional(),
  }).optional(),
  status:    z.enum(['draft', 'sent', 'signed', 'declined']).optional(),
  signed_at: z.string().nullable().optional(),
})

const createFormSchema = z.object({
  contact_id: z.string().uuid(),
  title:      z.string().min(1).max(300),
  fields:     z.array(z.object({
    id:          z.string(),
    type:        z.enum(['text', 'textarea', 'select', 'checkbox', 'date', 'file']),
    label:       z.string().max(500),
    placeholder: z.string().max(500).nullable(),
    required:    z.boolean(),
    options:     z.array(z.string().max(200)),
  })).optional(),
})

const updateFormSchema = z.object({
  title:        z.string().min(1).max(300).optional(),
  fields:       z.array(z.object({
    id:          z.string(),
    type:        z.enum(['text', 'textarea', 'select', 'checkbox', 'date', 'file']),
    label:       z.string().max(500),
    placeholder: z.string().max(500).nullable(),
    required:    z.boolean(),
    options:     z.array(z.string().max(200)),
  })).optional(),
  status:       z.enum(['draft', 'sent', 'submitted']).optional(),
  responses:    z.array(z.object({ field_id: z.string(), value: z.unknown() })).optional(),
  submitted_at: z.string().nullable().optional(),
})

// ── Contact service ───────────────────────────────────────────────────────────

export async function getContacts(db: SupabaseClient, ownerId: string): Promise<CrmContact[]> {
  return repo.listContacts(db, ownerId)
}

export async function getContactById(db: SupabaseClient, id: string, ownerId: string): Promise<CrmContact> {
  const contact = await repo.getContact(db, id, ownerId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  return contact
}

export async function createContact(
  db: SupabaseClient,
  ownerId: string,
  raw: unknown,
): Promise<CrmContact> {
  const parsed = createContactSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_CONTACT_VALIDATION_ERROR')
  }
  // New contacts get portal access on by default, so the invite link works the
  // moment it's copied — no separate "enable portal access" toggle step needed.
  // (The owner can still revoke access per-contact in Portal Settings.)
  return repo.createContact(db, ownerId, { ...parsed.data, portal_enabled: true } as CreateContactPayload)
}

export async function updateContact(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  raw: unknown,
): Promise<CrmContact> {
  const parsed = updateContactSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_CONTACT_VALIDATION_ERROR')
  }
  const existing = await repo.getContact(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  return repo.updateContact(db, id, ownerId, parsed.data as UpdateContactPayload)
}

export async function deleteContact(db: SupabaseClient, id: string, ownerId: string): Promise<void> {
  const existing = await repo.getContact(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  return repo.deleteContact(db, id, ownerId)
}

// ── Message service ───────────────────────────────────────────────────────────

export async function getMessages(db: SupabaseClient, contactId: string, ownerId: string): Promise<CrmMessage[]> {
  return repo.listMessages(db, contactId, ownerId)
}

export async function sendMessage(
  db: SupabaseClient,
  ownerId: string,
  senderId: string,
  raw: unknown,
): Promise<CrmMessage> {
  const parsed = createMessageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_MESSAGE_VALIDATION_ERROR')
  }
  const contact = await repo.getContact(db, parsed.data.contact_id, ownerId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  const message = await repo.createMessage(db, ownerId, senderId, parsed.data as CreateMessagePayload)
  announceToClient({
    contactId: parsed.data.contact_id,
    ownerId,
    type: 'message',
    title: 'New message',
    body: parsed.data.body.slice(0, 140),
    link: '/messages',
    entityType: 'crm_message',
    entityId: message.id,
  })
  return message
}

export async function readMessages(db: SupabaseClient, contactId: string, ownerId: string): Promise<void> {
  return repo.markMessagesRead(db, contactId, ownerId)
}

// ── File service ──────────────────────────────────────────────────────────────

export async function getFiles(db: SupabaseClient, contactId: string, ownerId: string): Promise<CrmFile[]> {
  return repo.listFiles(db, contactId, ownerId)
}

export async function addFile(
  db: SupabaseClient,
  ownerId: string,
  uploadedBy: string,
  payload: Omit<CrmFile, 'id' | 'created_at' | 'owner_id' | 'uploaded_by'>,
): Promise<CrmFile> {
  const contact = await repo.getContact(db, payload.contact_id, ownerId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  const file = await repo.createFile(db, ownerId, uploadedBy, payload)
  announceToClient({
    contactId: payload.contact_id,
    ownerId,
    type: 'file',
    title: 'New file shared',
    body: file.file_name,
    link: '/files',
    entityType: 'crm_file',
    entityId: file.id,
  })
  return file
}

export async function removeFile(db: SupabaseClient, id: string, ownerId: string): Promise<void> {
  return repo.deleteFile(db, id, ownerId)
}

// ── Contract service ──────────────────────────────────────────────────────────

export async function getContracts(db: SupabaseClient, contactId: string, ownerId: string): Promise<CrmContract[]> {
  return repo.listContracts(db, contactId, ownerId)
}

export async function getContractById(db: SupabaseClient, id: string, ownerId: string): Promise<CrmContract> {
  const contract = await repo.getContract(db, id, ownerId)
  if (!contract) throw new AppError(404, 'Contract not found.', 'CRM_CONTRACT_NOT_FOUND')
  return contract
}

export async function createContract(
  db: SupabaseClient,
  ownerId: string,
  raw: unknown,
): Promise<CrmContract> {
  const parsed = createContractSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_CONTRACT_VALIDATION_ERROR')
  }
  const contact = await repo.getContact(db, parsed.data.contact_id, ownerId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  const contract = await repo.createContract(db, ownerId, parsed.data as CreateContractPayload)
  // Only a SENT contract is something the client can act on — a draft isn't
  // theirs to see yet, so it stays silent until it's actually sent.
  if (contract.status === 'sent') {
    announceToClient({
      contactId: parsed.data.contact_id,
      ownerId,
      type: 'contract',
      title: 'A contract needs your signature',
      body: contract.title ?? null,
      link: '/contracts',
      entityType: 'crm_contract',
      entityId: contract.id,
    })
  }
  return contract
}

export async function updateContract(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  raw: unknown,
): Promise<CrmContract> {
  const parsed = updateContractSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_CONTRACT_VALIDATION_ERROR')
  }
  const existing = await repo.getContract(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Contract not found.', 'CRM_CONTRACT_NOT_FOUND')
  const contract = await repo.updateContract(db, id, ownerId, parsed.data as UpdateContractPayload)
  // Draft → sent is the moment it becomes the client's to deal with. Comparing
  // against `existing` keeps a later edit of an already-sent contract quiet
  // rather than pinging them again for the same thing.
  if (existing.status !== 'sent' && contract.status === 'sent') {
    announceToClient({
      contactId: contract.contact_id,
      ownerId,
      type: 'contract',
      title: 'A contract needs your signature',
      body: contract.title ?? null,
      link: '/contracts',
      entityType: 'crm_contract',
      entityId: contract.id,
    })
  }
  return contract
}

export async function deleteContract(db: SupabaseClient, id: string, ownerId: string): Promise<void> {
  const existing = await repo.getContract(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Contract not found.', 'CRM_CONTRACT_NOT_FOUND')
  return repo.deleteContract(db, id, ownerId)
}

// ── Form service ──────────────────────────────────────────────────────────────

export async function getForms(db: SupabaseClient, contactId: string, ownerId: string): Promise<CrmForm[]> {
  return repo.listForms(db, contactId, ownerId)
}

export async function getFormById(db: SupabaseClient, id: string, ownerId: string): Promise<CrmForm> {
  const form = await repo.getForm(db, id, ownerId)
  if (!form) throw new AppError(404, 'Form not found.', 'CRM_FORM_NOT_FOUND')
  return form
}

export async function createForm(
  db: SupabaseClient,
  ownerId: string,
  raw: unknown,
): Promise<CrmForm> {
  const parsed = createFormSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_FORM_VALIDATION_ERROR')
  }
  const contact = await repo.getContact(db, parsed.data.contact_id, ownerId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')
  const form = await repo.createForm(db, ownerId, parsed.data as CreateFormPayload)
  if (form.status === 'sent') {
    announceToClient({
      contactId: parsed.data.contact_id,
      ownerId,
      type: 'form',
      title: 'A form is waiting for you',
      body: form.title ?? null,
      link: '/forms',
      entityType: 'crm_form',
      entityId: form.id,
    })
  }
  return form
}

export async function updateForm(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  raw: unknown,
): Promise<CrmForm> {
  const parsed = updateFormSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid input.', 'CRM_FORM_VALIDATION_ERROR')
  }
  const existing = await repo.getForm(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Form not found.', 'CRM_FORM_NOT_FOUND')
  const form = await repo.updateForm(db, id, ownerId, parsed.data as UpdateFormPayload)
  if (existing.status !== 'sent' && form.status === 'sent') {
    announceToClient({
      contactId: form.contact_id,
      ownerId,
      type: 'form',
      title: 'A form is waiting for you',
      body: form.title ?? null,
      link: '/forms',
      entityType: 'crm_form',
      entityId: form.id,
    })
  }
  return form
}

export async function deleteForm(db: SupabaseClient, id: string, ownerId: string): Promise<void> {
  const existing = await repo.getForm(db, id, ownerId)
  if (!existing) throw new AppError(404, 'Form not found.', 'CRM_FORM_NOT_FOUND')
  return repo.deleteForm(db, id, ownerId)
}

// ── Notification service ──────────────────────────────────────────────────────

export async function getNotifications(db: SupabaseClient, ownerId: string): Promise<CrmNotification[]> {
  return repo.listNotifications(db, ownerId)
}

export async function markAllNotificationsRead(db: SupabaseClient, ownerId: string): Promise<void> {
  return repo.markNotificationsRead(db, ownerId)
}

/**
 * Retention sweep: deletes each owner's messages older than their configured
 * retention (message_retention_days, default 60). A value of 0 means keep
 * forever. Returns totals for logging.
 */
export async function pruneExpiredMessages(
  db: SupabaseClient,
): Promise<{ owners: number; deleted: number; filesDeleted: number }> {
  const { data } = await db.from('fey_settings').select('user_id, message_retention_days')
  const owners = (data ?? []) as Array<{ user_id: string; message_retention_days: string | null }>
  let deleted = 0
  let filesDeleted = 0
  for (const o of owners) {
    const days = Number(o.message_retention_days)
    const retention = Number.isFinite(days) && days > 0 ? days : 60
    const { count, fileUrls } = await repo.pruneOldMessages(db, o.user_id, retention)
    deleted += count
    // Best-effort attachment cleanup — never blocks the sweep.
    for (const url of fileUrls) {
      if (await destroyCloudinaryAsset(url)) filesDeleted++
    }
  }
  return { owners: owners.length, deleted, filesDeleted }
}

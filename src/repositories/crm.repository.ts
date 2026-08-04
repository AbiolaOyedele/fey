import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmContact,
  CrmMessage,
  CrmFile,
  CrmContract,
  CrmForm,
  CrmNotification,
  CrmPaymentRequest,
  CreateContactPayload,
  UpdateContactPayload,
  CreateMessagePayload,
  CreateContractPayload,
  UpdateContractPayload,
  CreateFormPayload,
  UpdateFormPayload,
  MessageAttachment,
  ContractContent,
  FormField,
  FormResponse,
} from '@/types/crm'

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listContacts(
  db: SupabaseClient,
  ownerId: string,
): Promise<CrmContact[]> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CrmContact[]
}

export async function getContact(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<CrmContact | null> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  return data as CrmContact | null
}

export async function createContact(
  db: SupabaseClient,
  ownerId: string,
  payload: CreateContactPayload,
): Promise<CrmContact> {
  const { data, error } = await db
    .from('crm_contacts')
    .insert({ ...payload, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data as CrmContact
}

export async function updateContact(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  payload: UpdateContactPayload,
): Promise<CrmContact> {
  const { data, error } = await db
    .from('crm_contacts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select()
    .single()
  if (error) throw error
  return data as CrmContact
}

export async function deleteContact(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_contacts')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw error
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listMessages(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmMessage[]> {
  const { data, error } = await db
    .from('crm_messages')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToMessage)
}

export async function createMessage(
  db: SupabaseClient,
  ownerId: string,
  senderId: string,
  payload: CreateMessagePayload,
): Promise<CrmMessage> {
  const { data, error } = await db
    .from('crm_messages')
    .insert({
      contact_id:  payload.contact_id,
      owner_id:    ownerId,
      sender_type: 'owner',
      sender_id:   senderId,
      body:        payload.body,
      body_html:   payload.body_html ?? null,
      attachments: payload.attachments ?? [],
    })
    .select()
    .single()
  if (error) throw error
  return rowToMessage(data)
}

export async function markMessagesRead(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .is('read_at', null)
    .neq('sender_type', 'owner')
  if (error) throw error
}

function rowToMessage(row: Record<string, unknown>): CrmMessage {
  return {
    id:          row.id as string,
    contact_id:  row.contact_id as string,
    owner_id:    row.owner_id as string,
    sender_type: row.sender_type as 'owner' | 'client',
    sender_id:   row.sender_id as string,
    body:        row.body as string,
    body_html:   (row.body_html as string | null) ?? null,
    attachments: (row.attachments as MessageAttachment[]) ?? [],
    read_at:     (row.read_at as string | null) ?? null,
    created_at:  row.created_at as string,
    edited_at:   (row.edited_at as string | null) ?? null,
    deleted_at:  (row.deleted_at as string | null) ?? null,
    deleted_by:  (row.deleted_by as string | null) ?? null,
    reply_to_id: (row.reply_to_id as string | null) ?? null,
  }
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function listFiles(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmFile[]> {
  const { data, error } = await db
    .from('crm_files')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CrmFile[]
}

export async function createFile(
  db: SupabaseClient,
  ownerId: string,
  uploadedBy: string,
  payload: Omit<CrmFile, 'id' | 'created_at' | 'owner_id' | 'uploaded_by'>,
): Promise<CrmFile> {
  const { data, error } = await db
    .from('crm_files')
    .insert({ ...payload, owner_id: ownerId, uploaded_by: uploadedBy })
    .select()
    .single()
  if (error) throw error
  return data as CrmFile
}

export async function deleteFile(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_files')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw error
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export async function listContracts(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmContract[]> {
  const { data, error } = await db
    .from('crm_contracts')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToContract)
}

export async function getContract(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<CrmContract | null> {
  const { data, error } = await db
    .from('crm_contracts')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToContract(data) : null
}

export async function createContract(
  db: SupabaseClient,
  ownerId: string,
  payload: CreateContractPayload,
): Promise<CrmContract> {
  const content: ContractContent = {
    body:            '',
    body_html:       '',
    effective_date:  null,
    expiry_date:     null,
    signature_block: '',
    ...payload.content,
  }
  const { data, error } = await db
    .from('crm_contracts')
    .insert({ contact_id: payload.contact_id, owner_id: ownerId, title: payload.title, content })
    .select()
    .single()
  if (error) throw error
  return rowToContract(data)
}

export async function updateContract(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  payload: UpdateContractPayload,
): Promise<CrmContract> {
  const updates: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() }
  const { data, error } = await db
    .from('crm_contracts')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select()
    .single()
  if (error) throw error
  return rowToContract(data)
}

export async function deleteContract(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_contracts')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw error
}

function rowToContract(row: Record<string, unknown>): CrmContract {
  return {
    id:          row.id as string,
    contact_id:  row.contact_id as string,
    owner_id:    row.owner_id as string,
    title:       row.title as string,
    share_token: row.share_token as string,
    status:      row.status as CrmContract['status'],
    content:     row.content as ContractContent,
    signed_at:   (row.signed_at as string | null) ?? null,
    created_at:  row.created_at as string,
    updated_at:  row.updated_at as string,
  }
}

// ── Forms ─────────────────────────────────────────────────────────────────────

export async function listForms(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmForm[]> {
  const { data, error } = await db
    .from('crm_forms')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToForm)
}

export async function getForm(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<CrmForm | null> {
  const { data, error } = await db
    .from('crm_forms')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToForm(data) : null
}

export async function createForm(
  db: SupabaseClient,
  ownerId: string,
  payload: CreateFormPayload,
): Promise<CrmForm> {
  const { data, error } = await db
    .from('crm_forms')
    .insert({
      contact_id: payload.contact_id,
      owner_id:   ownerId,
      title:      payload.title,
      fields:     payload.fields ?? [],
    })
    .select()
    .single()
  if (error) throw error
  return rowToForm(data)
}

export async function updateForm(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  payload: UpdateFormPayload,
): Promise<CrmForm> {
  const updates: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() }
  const { data, error } = await db
    .from('crm_forms')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select()
    .single()
  if (error) throw error
  return rowToForm(data)
}

export async function deleteForm(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_forms')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw error
}

function rowToForm(row: Record<string, unknown>): CrmForm {
  return {
    id:           row.id as string,
    contact_id:   row.contact_id as string,
    owner_id:     row.owner_id as string,
    title:        row.title as string,
    share_token:  row.share_token as string,
    status:       row.status as CrmForm['status'],
    fields:       (row.fields as FormField[]) ?? [],
    responses:    (row.responses as FormResponse[]) ?? [],
    submitted_at: (row.submitted_at as string | null) ?? null,
    created_at:   row.created_at as string,
    updated_at:   row.updated_at as string,
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function listNotifications(
  db: SupabaseClient,
  ownerId: string,
): Promise<CrmNotification[]> {
  const { data, error } = await db
    .from('crm_notifications')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as CrmNotification[]
}

export async function createNotification(
  db: SupabaseClient,
  ownerId: string,
  contactId: string | null,
  type: string,
  message: string,
): Promise<CrmNotification> {
  const { data, error } = await db
    .from('crm_notifications')
    .insert({ owner_id: ownerId, contact_id: contactId, type, message })
    .select()
    .single()
  if (error) throw error
  return data as CrmNotification
}

export async function markNotificationsRead(
  db: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
    .is('read_at', null)
  if (error) throw error
}

/**
 * Deletes a single owner's messages older than `retentionDays`. Returns the
 * count plus the Cloudinary URLs of any attachments on the deleted messages, so
 * the caller can clean up the files too.
 */
export async function pruneOldMessages(
  db: SupabaseClient,
  ownerId: string,
  retentionDays: number,
): Promise<{ count: number; fileUrls: string[] }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('crm_messages')
    .delete()
    .eq('owner_id', ownerId)
    .lt('created_at', cutoff)
    .select('id, attachments')
  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; attachments: MessageAttachment[] | null }>
  const fileUrls = rows.flatMap((r) => (r.attachments ?? []).map((a) => a.file_url)).filter(Boolean)
  return { count: rows.length, fileUrls }
}

// ── Payment requests ──────────────────────────────────────────────────────────

/**
 * Creates a payment link for a contact.
 *
 * share_token, status and expiry all come from column defaults, so only what
 * the owner actually typed is written here.
 */
export async function createPaymentRequest(
  db: SupabaseClient,
  payload: {
    owner_id: string
    contact_id: string
    amount: number
    currency: string
    description: string
    message: string
  },
): Promise<CrmPaymentRequest> {
  const { data, error } = await db
    .from('crm_payment_requests')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as CrmPaymentRequest
}

// ── Message edit / unsend ─────────────────────────────────────────────────────

/**
 * Deletes a message outright, and reports its attachments so the caller can
 * remove the files too.
 *
 * This used to soft-delete into a "This message was deleted" tombstone. The
 * tombstone was the problem: a thread full of them announces that something was
 * removed and invites the question of what, which is the opposite of what
 * someone pressing delete is asking for. The row goes. Replies that quoted it
 * simply render without a quote — `MessageThread` already handles a missing
 * parent, because a pruned thread could always produce one.
 */
export async function hardDeleteMessage(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<{ attachments: MessageAttachment[] }> {
  const { data, error } = await db
    .from('crm_messages')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('id, attachments')
    .maybeSingle()
  if (error) throw error
  const row = data as { attachments: MessageAttachment[] | null } | null
  return { attachments: row?.attachments ?? [] }
}

/**
 * Empties a whole client thread. Returns the count and every attachment URL on
 * the removed messages, so the binaries go with them.
 */
export async function clearMessages(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<{ count: number; fileUrls: string[] }> {
  const { data, error } = await db
    .from('crm_messages')
    .delete()
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .select('id, attachments')
  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; attachments: MessageAttachment[] | null }>
  return {
    count: rows.length,
    fileUrls: rows.flatMap((r) => (r.attachments ?? []).map((a) => a.file_url)).filter(Boolean),
  }
}

export async function editMessage(
  db: SupabaseClient,
  id: string,
  ownerId: string,
  body: string,
  bodyHtml: string | null,
): Promise<CrmMessage> {
  const { data, error } = await db
    .from('crm_messages')
    .update({ body, body_html: bodyHtml, edited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select()
    .single()
  if (error) throw error
  return rowToMessage(data)
}

export async function getMessage(
  db: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<CrmMessage | null> {
  const { data, error } = await db
    .from('crm_messages')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToMessage(data) : null
}

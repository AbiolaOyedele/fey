import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmContact, CrmMessage, CrmFile, CrmContract, CrmForm, PortalUser, PortalOwnerBranding, MessageAttachment, ContractContent, FormField, FormResponse } from '@/types/crm'

// ── Owner lookup by subdomain ─────────────────────────────────────────────────

export async function getOwnerBySubdomain(
  db: SupabaseClient,
  subdomain: string,
): Promise<PortalOwnerBranding | null> {
  const { data, error } = await db
    .from('fey_settings')
    .select('user_id, company_name, logo, accent_color, font_family, portal_subdomain, portal_active')
    .eq('portal_subdomain', subdomain)
    .eq('portal_active', true)
    .maybeSingle()
  if (error ?? !data) return null
  const row = data as Record<string, unknown>
  return {
    business_name: (row.company_name as string | null) ?? 'Workboard',
    logo_url:      (row.logo as string | null) ?? null,
    accent_color:  (row.accent_color as string | null) ?? '#ED64A6',
    font:          (row.font_family as string | null) ?? 'NoirPro',
    subdomain:     row.portal_subdomain as string,
    portal_active: (row.portal_active as boolean | null) ?? false,
  }
}

// ── Portal user lookup ────────────────────────────────────────────────────────

export async function getPortalUser(
  db: SupabaseClient,
  userId: string,
): Promise<PortalUser | null> {
  const { data, error } = await db
    .from('portal_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error ?? !data) return null
  return data as PortalUser
}

export async function getPortalUserByContactAndOwner(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<PortalUser | null> {
  const { data, error } = await db
    .from('portal_users')
    .select('*')
    .eq('contact_id', contactId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error ?? !data) return null
  return data as PortalUser
}

export async function createPortalUser(
  db: SupabaseClient,
  payload: PortalUser,
): Promise<void> {
  const { error } = await db.from('portal_users').insert(payload)
  if (error) throw error
}

// ── Contact for portal client ─────────────────────────────────────────────────

export async function getContactForPortalUser(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmContact | null> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('*')
    .eq('id', contactId)
    .eq('owner_id', ownerId)
    .eq('portal_enabled', true)
    .maybeSingle()
  if (error ?? !data) return null
  return data as CrmContact
}

export async function getContactById(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmContact | null> {
  const { data, error } = await db
    .from('crm_contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle()
  if (error ?? !data) return null
  return data as CrmContact
}

// ── Portal messages ───────────────────────────────────────────────────────────

export async function listPortalMessages(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmMessage[]> {
  const { data, error } = await db
    .from('crm_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToMessage)
}

export async function createPortalMessage(
  db: SupabaseClient,
  ownerId: string,
  senderId: string,
  contactId: string,
  body: string,
  bodyHtml: string | null,
  attachments: MessageAttachment[],
): Promise<CrmMessage> {
  const { data, error } = await db
    .from('crm_messages')
    .insert({
      contact_id:  contactId,
      owner_id:    ownerId,
      sender_type: 'client',
      sender_id:   senderId,
      body,
      body_html:   bodyHtml,
      attachments,
    })
    .select()
    .single()
  if (error) throw error
  return rowToMessage(data)
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
  }
}

// ── Portal files ──────────────────────────────────────────────────────────────

export async function listPortalFiles(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmFile[]> {
  const { data, error } = await db
    .from('crm_files')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CrmFile[]
}

// ── Portal contracts ──────────────────────────────────────────────────────────

export async function listPortalContracts(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmContract[]> {
  const { data, error } = await db
    .from('crm_contracts')
    .select('*')
    .eq('contact_id', contactId)
    .in('status', ['sent', 'signed', 'declined'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
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
  }))
}

export async function signContract(
  db: SupabaseClient,
  contractId: string,
  contactId: string,
): Promise<void> {
  const { error } = await db
    .from('crm_contracts')
    .update({ status: 'signed', signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', contractId)
    .eq('contact_id', contactId)
    .eq('status', 'sent')
  if (error) throw error
}

// ── Portal forms ──────────────────────────────────────────────────────────────

export async function listPortalForms(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmForm[]> {
  const { data, error } = await db
    .from('crm_forms')
    .select('*')
    .eq('contact_id', contactId)
    .in('status', ['sent', 'submitted'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
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
  }))
}

export async function submitForm(
  db: SupabaseClient,
  formId: string,
  contactId: string,
  responses: FormResponse[],
): Promise<void> {
  const { error } = await db
    .from('crm_forms')
    .update({
      status:       'submitted',
      responses,
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', formId)
    .eq('contact_id', contactId)
    .eq('status', 'sent')
  if (error) throw error
}

// ── Owner settings lookup ─────────────────────────────────────────────────────

export async function getOwnerSettings(
  db: SupabaseClient,
  ownerId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from('fey_settings')
    .select('*')
    .eq('user_id', ownerId)
    .maybeSingle()
  if (error ?? !data) return null
  return data as Record<string, unknown>
}

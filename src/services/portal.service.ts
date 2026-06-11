import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import * as portalRepo from '@/repositories/portal.repository'
import * as crmRepo    from '@/repositories/crm.repository'
import type {
  CrmContact,
  CrmMessage,
  CrmFile,
  CrmContract,
  CrmForm,
  PortalUser,
  PortalOwnerBranding,
  MessageAttachment,
  FormResponse,
} from '@/types/crm'
import { z } from 'zod'

// ── Validation schemas ────────────────────────────────────────────────────────

const portalSignupSchema = z.object({
  subdomain:  z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase letters, numbers, and hyphens only'),
  name:       z.string().min(1).max(200),
  email:      z.string().email(),
  password:   z.string().min(8).max(128),
  contact_id: z.string().uuid(),
})

const portalMessageSchema = z.object({
  body:        z.string().min(1).max(20_000),
  body_html:   z.string().max(50_000).optional().nullable(),
  attachments: z.array(z.object({
    file_name: z.string().max(500),
    file_url:  z.string().url(),
    file_type: z.string().max(100),
    file_size: z.number().int().nonnegative(),
  })).optional(),
})

// ── Owner branding ────────────────────────────────────────────────────────────

export async function getOwnerBranding(
  db: SupabaseClient,
  subdomain: string,
): Promise<PortalOwnerBranding> {
  const branding = await portalRepo.getOwnerBySubdomain(db, subdomain)
  if (!branding) throw new AppError(404, 'Portal not found.', 'PORTAL_NOT_FOUND')
  if (!branding.portal_active) throw new AppError(403, 'This portal is not active.', 'PORTAL_INACTIVE')
  return branding
}

// ── Portal user ───────────────────────────────────────────────────────────────

export async function getPortalUser(db: SupabaseClient, userId: string): Promise<PortalUser> {
  const user = await portalRepo.getPortalUser(db, userId)
  if (!user) throw new AppError(403, 'Portal access not found.', 'PORTAL_USER_NOT_FOUND')
  return user
}

export async function getClientContact(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
): Promise<CrmContact> {
  const contact = await portalRepo.getContactForPortalUser(db, contactId, ownerId)
  if (!contact) throw new AppError(403, 'Access denied.', 'PORTAL_ACCESS_DENIED')
  return contact
}

// ── Portal signup ─────────────────────────────────────────────────────────────

export interface SignupResult {
  userId: string
  ownerId: string
  contactId: string
  contactName: string
  ownerEmail: string
}

export async function validateSignupPayload(raw: unknown) {
  const parsed = portalSignupSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid signup data.', 'PORTAL_SIGNUP_VALIDATION')
  }
  return parsed.data
}

export async function resolveOwnerForSignup(
  db: SupabaseClient,
  subdomain: string,
  contactId: string,
): Promise<{ ownerId: string; ownerEmail: string }> {
  const branding = await portalRepo.getOwnerBySubdomain(db, subdomain)
  if (!branding) throw new AppError(404, 'Portal not found.', 'PORTAL_NOT_FOUND')
  if (!branding.portal_active) throw new AppError(403, 'This portal is not active.', 'PORTAL_INACTIVE')

  const contact = await portalRepo.getContactById(db, contactId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')

  // Look up owner email from auth.users via admin client — returned by caller
  return { ownerId: contact.owner_id, ownerEmail: '' }
}

// ── Portal messages ───────────────────────────────────────────────────────────

export async function getPortalMessages(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmMessage[]> {
  return portalRepo.listPortalMessages(db, contactId)
}

export async function sendPortalMessage(
  db: SupabaseClient,
  portalUser: PortalUser,
  raw: unknown,
): Promise<CrmMessage> {
  const parsed = portalMessageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid message.', 'PORTAL_MESSAGE_VALIDATION')
  }
  return portalRepo.createPortalMessage(
    db,
    portalUser.owner_id,
    portalUser.id,
    portalUser.contact_id,
    parsed.data.body,
    parsed.data.body_html ?? null,
    (parsed.data.attachments ?? []) as MessageAttachment[],
  )
}

// ── Portal files ──────────────────────────────────────────────────────────────

export async function getPortalFiles(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmFile[]> {
  return portalRepo.listPortalFiles(db, contactId)
}

// ── Portal contracts ──────────────────────────────────────────────────────────

export async function getPortalContracts(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmContract[]> {
  return portalRepo.listPortalContracts(db, contactId)
}

export async function signPortalContract(
  db: SupabaseClient,
  contractId: string,
  contactId: string,
): Promise<void> {
  return portalRepo.signContract(db, contractId, contactId)
}

// ── Portal forms ──────────────────────────────────────────────────────────────

export async function getPortalForms(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmForm[]> {
  return portalRepo.listPortalForms(db, contactId)
}

export async function submitPortalForm(
  db: SupabaseClient,
  formId: string,
  contactId: string,
  responses: FormResponse[],
): Promise<void> {
  return portalRepo.submitForm(db, formId, contactId, responses)
}

// ── Notify owner ──────────────────────────────────────────────────────────────

export async function createSignupNotification(
  db: SupabaseClient,
  ownerId: string,
  contactId: string,
  clientName: string,
): Promise<void> {
  await crmRepo.createNotification(
    db,
    ownerId,
    contactId,
    'client_signup',
    `${clientName} just joined your portal`,
  )
}

import type { SupabaseClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { AppError } from '@/lib/errors'
import * as portalRepo from '@/repositories/portal.repository'
import * as crmRepo    from '@/repositories/crm.repository'
import { destroyCloudinaryAsset } from '@/lib/cloudinary-server'
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
  PortalInvoice,
  PortalPayment,
  PortalTask,
} from '@/types/crm'
import { z } from 'zod'

// ── Validation schemas ────────────────────────────────────────────────────────

const portalSignupSchema = z.object({
  workspace_slug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'Workspace slug must be lowercase letters, numbers, and hyphens only'),
  name:           z.string().min(1).max(200),
  email:          z.string().email(),
  password:       z.string().min(8).max(128),
  contact_id:     z.string().uuid(),
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
  workspaceSlug: string,
): Promise<PortalOwnerBranding> {
  const branding = await portalRepo.getOwnerByWorkspaceSlug(db, workspaceSlug)
  if (!branding) throw new AppError(404, 'Portal not found.', 'PORTAL_NOT_FOUND')
  if (!branding.portal_active) throw new AppError(403, 'This portal is not active.', 'PORTAL_INACTIVE')
  return branding
}

// ── Portal user ───────────────────────────────────────────────────────────────

/** What `locatePortalAccount` found, if anything. */
export interface LocatedPortalAccount {
  workspace_slug: string
  business_name: string | null
}

/** Shape-matched to a real hash, so a miss costs the same as a wrong password. */
const DUMMY_HASH = '$2b$12$invaliddummyhashfortimingreasons000000000000000000000000'

/**
 * Which client portal a set of credentials belongs to, if any.
 *
 * For someone who has typed client details into the agency's own sign-in form.
 * That form authenticates against Supabase Auth, and portal users deliberately
 * aren't there — they're rows in portal_users with a bcrypt hash — so it can
 * never sign them in however correct their details are, and all it can tell
 * them is that the credentials are invalid. They aren't. They're for a
 * different door, and this finds which one.
 *
 * On enumeration, which the rest of portal auth is careful about: the workspace
 * comes back ONLY when the password verifies. Anyone who gets an answer has
 * proved they already hold the credential, so they learn nothing they didn't
 * arrive with. A wrong password is indistinguishable from an address that was
 * never registered — same null, and a bcrypt comparison runs either way so the
 * two don't separate on timing.
 */
export async function locatePortalAccount(
  db: SupabaseClient,
  email: string,
  password: string,
): Promise<LocatedPortalAccount | null> {
  const rows = await portalRepo.listPortalCredentialsByEmail(db, email)

  if (rows.length === 0) {
    await bcrypt.compare(password, DUMMY_HASH)
    return null
  }

  let match: string | null = null
  for (const row of rows) {
    const ok = await bcrypt.compare(password, row.password_hash ?? DUMMY_HASH)
    // Deliberately no early exit. The same address can be a client of several
    // agencies, and stopping at the first hit would leak how far down the list
    // it sat.
    if (ok && !match) match = row.workspace_slug
  }
  if (!match) return null

  const branding = await portalRepo.getOwnerByWorkspaceSlug(db, match)
  return { workspace_slug: match, business_name: branding?.business_name ?? null }
}

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
  workspaceSlug: string,
  contactId: string,
): Promise<{ ownerId: string; ownerEmail: string }> {
  const branding = await portalRepo.getOwnerByWorkspaceSlug(db, workspaceSlug)
  if (!branding) throw new AppError(404, 'Portal not found.', 'PORTAL_NOT_FOUND')
  if (!branding.portal_active) throw new AppError(403, 'This portal is not active.', 'PORTAL_INACTIVE')

  const contact = await portalRepo.getContactById(db, contactId)
  if (!contact) throw new AppError(404, 'Contact not found.', 'CRM_CONTACT_NOT_FOUND')

  return { ownerId: contact.owner_id, ownerEmail: '' }
}

// ── Portal messages ───────────────────────────────────────────────────────────

export async function getPortalMessages(
  db: SupabaseClient,
  contactId: string,
): Promise<CrmMessage[]> {
  return portalRepo.listPortalMessages(db, contactId)
}

/**
 * Portal message view for the client.
 *
 * `unread` counts only what the AGENCY sent and the client hasn't opened. That
 * distinction is the whole point: `read_at` means "seen by the recipient", so on
 * a message the client sent it stays null until the agency reads it. Counting
 * every null therefore counts the client's own outbox, which is how the portal
 * dashboard came to announce "1 unread message" to someone with nothing waiting.
 *
 * It's also counted BEFORE the marking below, so the number describes the thread
 * as the client found it rather than as this call left it.
 *
 * `markRead` is opt-in for the same reason. Marking on every read meant merely
 * loading the dashboard told the agency the client had read their messages —
 * turning the owner's "Sent → Read" receipt into a lie. Only opening the thread
 * counts as reading it.
 */
export async function getPortalMessageView(
  db: SupabaseClient,
  contactId: string,
  ownerId: string,
  opts: { markRead: boolean } = { markRead: true },
): Promise<{ messages: CrmMessage[]; read_receipts: boolean; unread: number }> {
  const before = await portalRepo.listPortalMessages(db, contactId)
  const unread = before.filter((m) => m.sender_type === 'owner' && !m.read_at && !m.deleted_at).length

  if (!opts.markRead) {
    const settings = await portalRepo.getOwnerSettings(db, ownerId)
    return {
      messages: before,
      read_receipts: String(settings?.portal_read_receipts ?? 'true') !== 'false',
      unread,
    }
  }

  await portalRepo.markOwnerMessagesRead(db, contactId)
  const messages = await portalRepo.listPortalMessages(db, contactId)
  const settings = await portalRepo.getOwnerSettings(db, ownerId)
  const read_receipts = String(settings?.portal_read_receipts ?? 'true') !== 'false'
  return { messages, read_receipts, unread }
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
  // Never persist client-supplied HTML. The portal composer only ever sends plain
  // text (body_html: null); forcing null here closes the path where a crafted
  // request stores markup that later renders in the owner's session (stored XSS).
  return portalRepo.createPortalMessage(
    db,
    portalUser.owner_id,
    portalUser.id,
    portalUser.contact_id,
    parsed.data.body,
    null,
    (parsed.data.attachments ?? []) as MessageAttachment[],
  )
}

/**
 * Deletes one of the client's own messages, permanently.
 *
 * A client gets the same delete the agency has, limited to their own words —
 * removing the agency's messages would be editing someone else's record.
 */
export async function deletePortalMessage(
  db: SupabaseClient,
  portalUser: PortalUser,
  messageId: string,
): Promise<void> {
  const { deleted, attachments } = await portalRepo.deletePortalMessage(
    db, messageId, portalUser.contact_id, portalUser.id,
  )
  if (!deleted) {
    throw new AppError(404, 'That message isn’t one you sent, so it can’t be deleted.', 'PORTAL_MESSAGE_NOT_YOURS')
  }
  for (const a of attachments) {
    if (a.file_url) await destroyCloudinaryAsset(a.file_url)
  }
}

/**
 * Clears the client's whole thread with the agency.
 *
 * This removes the agency's messages too, because a half-cleared conversation
 * isn't cleared. Both sides can do it and both sides lose it — that symmetry is
 * the point of "clear chat", and the confirmation dialog says so before it runs.
 */
export async function clearPortalMessages(
  db: SupabaseClient,
  portalUser: PortalUser,
): Promise<{ cleared: number }> {
  const { count, fileUrls } = await portalRepo.clearPortalMessages(db, portalUser.contact_id)
  for (const url of fileUrls) await destroyCloudinaryAsset(url)
  return { cleared: count }
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

// ── Portal invoices / payments / tasks (read-only) ────────────────────────────

export async function getPortalInvoices(
  db: SupabaseClient,
  contactId: string,
): Promise<PortalInvoice[]> {
  return portalRepo.listPortalInvoices(db, contactId)
}

export async function getPortalPayments(
  db: SupabaseClient,
  contactId: string,
): Promise<PortalPayment[]> {
  return portalRepo.listPortalPayments(db, contactId)
}

export async function getPortalTasks(
  db: SupabaseClient,
  contactId: string,
): Promise<PortalTask[]> {
  return portalRepo.listPortalTasks(db, contactId)
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

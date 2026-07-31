import { createServiceClient } from '@/lib/supabase-server'
import { notify, notifyOwnerAdmins } from '@/services/notifications.service'

/**
 * Image Pipeline notifications. These write rows for *other* users, which RLS
 * forbids from a user client, so each helper builds its own service-role client.
 * Every helper is best-effort: notify()/notifyOwnerAdmins() already swallow their
 * own errors, so a notification can never break the credit action that triggered
 * it. The actor is never notified about their own action.
 */

const ADMIN_LINK = '/playground/image-pipeline/admin'
const CREDITS_LINK = '/playground/image-pipeline/credits'

/** "1 credit" / "2.5 credits" — matches the UI's phrasing. */
function creditsLabel(amount: number): string {
  const n = Math.round(amount * 100) / 100
  return `${n} ${n === 1 ? 'credit' : 'credits'}`
}

/** A member filed a top-up request → tell the owner + workspace admins. */
export async function notifyCreditRequestFiled(args: {
  ownerId: string
  actorId: string
  requesterName: string | null
  amount: number
}): Promise<void> {
  const db = createServiceClient()
  await notifyOwnerAdmins(db, args.ownerId, {
    actorId: args.actorId,
    type: 'image_credit_request',
    title: 'New credit request',
    body: `${args.requesterName ?? 'A teammate'} requested ${creditsLabel(args.amount)} for the Image Pipeline.`,
    link: ADMIN_LINK,
    entityType: 'ip_credit_request',
  })
}

/** An admin granted credits directly → tell the recipient. */
export async function notifyCreditsGranted(args: {
  recipientId: string
  actorId: string
  amount: number
}): Promise<void> {
  const db = createServiceClient()
  await notify({
    db,
    recipientIds: [args.recipientId],
    actorId: args.actorId,
    type: 'image_credits_granted',
    title: 'Credits added',
    body: `You were granted ${creditsLabel(args.amount)} for the Image Pipeline.`,
    link: CREDITS_LINK,
    entityType: 'ip_credit_ledger',
  })
}

/** An admin approved/denied a request → tell the requester. */
export async function notifyCreditRequestResolved(args: {
  recipientId: string
  actorId: string
  decision: 'approved' | 'denied'
  amount: number
}): Promise<void> {
  const db = createServiceClient()
  const approved = args.decision === 'approved'
  await notify({
    db,
    recipientIds: [args.recipientId],
    actorId: args.actorId,
    type: 'image_credit_request_resolved',
    title: approved ? 'Credit request approved' : 'Credit request declined',
    body: approved
      ? `Your request for ${creditsLabel(args.amount)} was approved — the credits are in your balance.`
      : `Your request for ${creditsLabel(args.amount)} wasn’t approved this time.`,
    link: CREDITS_LINK,
    entityType: 'ip_credit_request',
  })
}

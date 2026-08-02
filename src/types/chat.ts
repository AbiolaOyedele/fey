/**
 * Shared chat rules, applied identically to internal chat, CRM messages and the
 * client portal's team chat.
 *
 * The behaviour follows WhatsApp on purpose — most clients arrive from it, so
 * matching its model means nothing has to be explained. That includes its two
 * time windows and, importantly, its two different deletes.
 */

/**
 * How long after sending a message may be unsent for everyone. WhatsApp allows
 * roughly 48 hours; past it, the sender can still hide it for themselves.
 */
export const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000

/** How long a message stays editable. WhatsApp allows 15 minutes. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000

/** Which message table an id belongs to — reactions and hides are shared tables. */
export const MESSAGE_SCOPES = ['internal', 'crm', 'portal_team'] as const
export type MessageScope = (typeof MESSAGE_SCOPES)[number]

/**
 * WhatsApp's two deletes, which behave very differently:
 *   • everyone — replaces the message for all participants with a tombstone
 *   • me       — hides it for the person who chose it; everyone else still sees it
 */
export const DELETE_MODES = ['everyone', 'me'] as const
export type DeleteMode = (typeof DELETE_MODES)[number]

/** Shown in place of a message that was unsent. */
export const DELETED_MESSAGE_PLACEHOLDER = 'This message was deleted'

/** The reaction set offered in the picker, in WhatsApp's order. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

export interface MessageReaction {
  id: string
  message_id: string
  scope: MessageScope
  reactor_id: string
  reactor_name: string
  emoji: string
  created_at: string
}

/** Reactions collapsed for display: one row per emoji with who reacted. */
export interface ReactionSummary {
  emoji: string
  count: number
  names: string[]
  /** Whether the current viewer is one of them. */
  mine: boolean
}

export function summariseReactions(
  reactions: MessageReaction[],
  viewerId: string | null,
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>()
  for (const r of reactions) {
    const existing = byEmoji.get(r.emoji)
    if (existing) {
      existing.count += 1
      existing.names.push(r.reactor_name || 'Someone')
      if (r.reactor_id === viewerId) existing.mine = true
    } else {
      byEmoji.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        names: [r.reactor_name || 'Someone'],
        mine: r.reactor_id === viewerId,
      })
    }
  }
  // Most-reacted first, so the busiest emoji leads.
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}

/** A message, in the shape these rules need. */
export interface DeletableMessage {
  sender_id: string
  created_at: string
  deleted_at?: string | null
}

function ageMs(createdAt: string, now: number): number {
  return now - new Date(createdAt).getTime()
}

/**
 * Whether `viewerId` may unsend this for everyone.
 *
 * Senders get the 48h window. An admin (workspace admin, or the agency owner on
 * a client thread) may remove anyone's message at any time — the same authority
 * WhatsApp gives a group admin, and the reason `isAdmin` bypasses the window.
 */
export function canDeleteForEveryone(
  message: DeletableMessage,
  viewerId: string | null,
  isAdmin = false,
  now: number = Date.now(),
): boolean {
  if (message.deleted_at) return false
  if (isAdmin) return true
  if (!viewerId || message.sender_id !== viewerId) return false
  return ageMs(message.created_at, now) <= DELETE_FOR_EVERYONE_WINDOW_MS
}

/**
 * Whether the sender may still edit. Only the sender, only inside the window,
 * and never once it has been deleted.
 */
export function canEdit(
  message: DeletableMessage,
  viewerId: string | null,
  now: number = Date.now(),
): boolean {
  if (message.deleted_at) return false
  if (!viewerId || message.sender_id !== viewerId) return false
  return ageMs(message.created_at, now) <= EDIT_WINDOW_MS
}

/** Anyone may hide any message for themselves, at any time. */
export function canDeleteForMe(message: DeletableMessage): boolean {
  return !message.deleted_at
}

/** Remaining edit time in whole seconds — for a countdown next to the control. */
export function editSecondsLeft(message: DeletableMessage, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((EDIT_WINDOW_MS - ageMs(message.created_at, now)) / 1000))
}

/** One-line preview of a quoted message, for the reply bar and the bubble. */
export function replyPreview(body: string | null | undefined, deleted = false): string {
  if (deleted) return DELETED_MESSAGE_PLACEHOLDER
  const text = (body ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Attachment'
  return text.length > 120 ? `${text.slice(0, 119)}…` : text
}

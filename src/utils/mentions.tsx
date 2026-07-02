import type { ReactNode } from 'react'
import { linkifyText } from '@/utils/linkify'
import { escapeHtml } from '@/utils/contentEditableCaret'

// Plain-text token for a mention embedded directly in a text field, e.g. task
// description or a chat message body: @[Full Name](user:<uuid>)
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g

// CRM messages store a real HTML mention chip instead (see RichTextComposer):
// <span data-mention="user:<uuid>" ...>@Name</span>
const MENTION_HTML_ATTR_RE = /data-mention="user:([0-9a-fA-F-]{36})"/g

// Chip styling intentionally has no background/text color of its own — it
// inherits whatever color surrounds it (bubble text, body text, etc.) via
// bold + underline instead. A fixed accent color would go invisible against
// an accent-colored chat bubble (own messages use the accent as background).
export const MENTION_CHIP_STYLE = 'font-weight:600;text-decoration:underline;text-underline-offset:2px;'
const MENTION_CHIP_CLASS = 'font-semibold underline underline-offset-2'

/** Builds the plain-text mention token to splice into a text field. */
export function formatMentionToken(name: string, userId: string): string {
  const safeName = name.replace(/[[\]()]/g, '')
  return `@[${safeName}](user:${userId})`
}

/** Builds a real HTML mention chip (used by contenteditable-based composers). */
export function mentionChipHtml(name: string, userId: string): string {
  return `<span data-mention="user:${userId}" contenteditable="false" style="${MENTION_CHIP_STYLE}">@${escapeHtml(name)}</span>`
}

/** Dedup list of user IDs mentioned via the plain-text token format. */
export function extractMentionedUserIds(text: string): string[] {
  const ids = new Set<string>()
  for (const m of text.matchAll(MENTION_TOKEN_RE)) if (m[2]) ids.add(m[2])
  return [...ids]
}

/** Dedup list of user IDs mentioned via the HTML mention-chip format (CRM messages). */
export function extractMentionedUserIdsFromHtml(html: string): string[] {
  const ids = new Set<string>()
  for (const m of html.matchAll(MENTION_HTML_ATTR_RE)) if (m[1]) ids.add(m[1])
  return [...ids]
}

/**
 * Renders plain text to React nodes, turning mention tokens into bold,
 * underlined "@Name" chips (color inherited from context — see
 * MENTION_CHIP_STYLE) and running the existing linkifyText() over the text in
 * between so plain URLs keep working in the same field.
 */
export function renderMentions(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let i = 0
  for (const m of text.matchAll(MENTION_TOKEN_RE)) {
    const [full, name] = m
    const index = m.index ?? 0
    if (index > lastIndex) nodes.push(...linkifyText(text.slice(lastIndex, index)))
    nodes.push(
      <span key={`mention-${i++}`} className={MENTION_CHIP_CLASS}>
        @{name}
      </span>,
    )
    lastIndex = index + full.length
  }
  if (lastIndex < text.length) nodes.push(...linkifyText(text.slice(lastIndex)))
  return nodes
}

/** Builds contenteditable innerHTML from a plain-text value containing mention tokens. */
export function buildMentionHtml(value: string): string {
  let html = ''
  let last = 0
  for (const m of value.matchAll(MENTION_TOKEN_RE)) {
    const [full, name, id] = m
    const index = m.index ?? 0
    if (index > last) html += escapeHtml(value.slice(last, index)).replace(/\n/g, '<br>')
    html += mentionChipHtml(name, id)
    last = index + full.length
  }
  if (last < value.length) html += escapeHtml(value.slice(last)).replace(/\n/g, '<br>')
  return html
}

/** Reconstructs the plain-text token value from a contenteditable's current DOM. */
export function serializeMentionEditor(el: HTMLElement): string {
  let out = ''
  for (const child of Array.from(el.childNodes)) out += serializeNode(child)
  return out
}

function serializeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  if (el.tagName === 'BR') return '\n'
  const mentionAttr = el.getAttribute('data-mention')
  if (mentionAttr?.startsWith('user:')) {
    const userId = mentionAttr.slice(5)
    const name = (el.textContent ?? '').replace(/^@/, '')
    return formatMentionToken(name, userId)
  }
  let out = ''
  for (const child of Array.from(el.childNodes)) out += serializeNode(child)
  if (el.tagName === 'DIV') out += '\n'
  return out
}

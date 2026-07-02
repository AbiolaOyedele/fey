import type { ReactNode } from 'react'
import { linkifyText } from '@/utils/linkify'

// Plain-text token for a mention embedded directly in a text field, e.g. task
// description or a chat message body: @[Full Name](user:<uuid>)
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g

// CRM messages store a real HTML mention chip instead (see RichTextComposer):
// <span data-mention="user:<uuid>" ...>@Name</span>
const MENTION_HTML_ATTR_RE = /data-mention="user:([0-9a-fA-F-]{36})"/g

/** Builds the plain-text mention token to splice into a text field. */
export function formatMentionToken(name: string, userId: string): string {
  const safeName = name.replace(/[[\]()]/g, '')
  return `@[${safeName}](user:${userId})`
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
 * Renders plain text to React nodes, turning mention tokens into accent-tinted
 * "@Name" chips and running the existing linkifyText() over the text in
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
      <span
        key={`mention-${i++}`}
        className="inline-flex items-center font-medium rounded px-1 py-0.5 -mx-0.5"
        style={{ backgroundColor: 'color-mix(in srgb, var(--accent, #ED64A6) 15%, transparent)', color: 'var(--accent, #ED64A6)' }}
      >
        @{name}
      </span>,
    )
    lastIndex = index + full.length
  }
  if (lastIndex < text.length) nodes.push(...linkifyText(text.slice(lastIndex)))
  return nodes
}

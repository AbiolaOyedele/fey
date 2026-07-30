import type { ReactNode } from 'react'
import { linkifyText } from '@/utils/linkify'
import { escapeHtml } from '@/utils/contentEditableCaret'
import { inlineImageUrl } from '@/utils/cloudinary'
import { IMAGE_TOKEN_RE, isHostedImageUrl, formatImageToken } from '@/utils/imageTokens'

export { isHostedImageUrl, formatImageToken }

// Plain-text token for a mention embedded directly in a text field, e.g. task
// description or a chat message body: @[Full Name](user:<uuid>)
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g

// Single pass over both token kinds so they can be interleaved in one string.
// Groups: 1 = mention name, 2 = user id, 3 = image name, 4 = image url.
const TOKEN_RE = new RegExp(`${MENTION_TOKEN_RE.source}|${IMAGE_TOKEN_RE.source}`, 'g')

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

/**
 * Builds the inline <img> a contenteditable composer shows for an image token.
 * Rendered at thumbnail width — the full-size URL stays on the data attribute
 * so serialization round-trips back to the exact same token.
 */
export function imageChipHtml(name: string, url: string): string {
  return (
    `<img data-image-url="${escapeHtml(url)}" data-image-name="${escapeHtml(name)}" ` +
    `src="${escapeHtml(inlineImageUrl(url, 480))}" alt="${escapeHtml(name)}" ` +
    `contenteditable="false" draggable="false" ` +
    `style="display:block;max-width:100%;height:auto;border-radius:0.75rem;margin:0.375rem 0;">`
  )
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

export interface RenderMentionsOptions {
  /**
   * Called when an inline image is clicked — use it to open a preview. Without
   * it the image is still clickable, opening the full-size file in a new tab.
   */
  onImageClick?: (image: { url: string; name: string }) => void
}

/**
 * Renders plain text to React nodes, turning mention tokens into bold,
 * underlined "@Name" chips (color inherited from context — see
 * MENTION_CHIP_STYLE), image tokens into clickable inline thumbnails, and
 * running the existing linkifyText() over the text in between so plain URLs
 * keep working in the same field.
 */
export function renderMentions(text: string, options: RenderMentionsOptions = {}): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let i = 0
  for (const m of text.matchAll(TOKEN_RE)) {
    const [full, name, , imageName, imageUrl] = m
    const index = m.index ?? 0
    if (index > lastIndex) nodes.push(...linkifyText(text.slice(lastIndex, index)))
    if (imageUrl && isHostedImageUrl(imageUrl)) {
      nodes.push(
        <InlineImage
          key={`image-${i++}`}
          url={imageUrl}
          name={imageName || 'image'}
          onImageClick={options.onImageClick}
        />,
      )
    } else if (name) {
      nodes.push(
        <span key={`mention-${i++}`} className={MENTION_CHIP_CLASS}>
          @{name}
        </span>,
      )
    }
    lastIndex = index + full.length
  }
  if (lastIndex < text.length) nodes.push(...linkifyText(text.slice(lastIndex)))
  return nodes
}

function InlineImage({
  url, name, onImageClick,
}: {
  url: string
  name: string
  onImageClick?: ((image: { url: string; name: string }) => void) | undefined
}) {
  const className = 'block my-1.5 max-w-full sm:max-w-xs rounded-xl overflow-hidden border border-gray-100 bg-gray-50'
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, already width-capped and f_auto.
    <img src={inlineImageUrl(url, 640)} alt={name} loading="lazy" className="w-full h-auto object-contain" />
  )
  if (!onImageClick) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={className}>
        {image}
      </a>
    )
  }
  return (
    <button
      type="button"
      title={name}
      onClick={(e) => { e.stopPropagation(); onImageClick({ url, name }) }}
      className={className}
    >
      {image}
    </button>
  )
}

/** Builds contenteditable innerHTML from a plain-text value containing mention/image tokens. */
export function buildMentionHtml(value: string): string {
  let html = ''
  let last = 0
  for (const m of value.matchAll(TOKEN_RE)) {
    const [full, name, id, imageName, imageUrl] = m
    const index = m.index ?? 0
    if (index > last) html += escapeHtml(value.slice(last, index)).replace(/\n/g, '<br>')
    if (imageUrl && isHostedImageUrl(imageUrl)) html += imageChipHtml(imageName || 'image', imageUrl)
    else if (name) html += mentionChipHtml(name, id)
    else html += escapeHtml(full)
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
  if (el.tagName === 'IMG') {
    // Only our own uploaded images survive: anything else (a pasted blob/data
    // URL, a dragged-in remote image) has no hosted URL to store.
    const url = el.getAttribute('data-image-url')
    if (url && isHostedImageUrl(url)) return formatImageToken(el.getAttribute('data-image-name') ?? 'image', url)
    return ''
  }
  // Upload placeholders are transient UI — never part of the saved value.
  if (el.hasAttribute('data-upload-id')) return ''
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

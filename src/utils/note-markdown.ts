/**
 * A very small Markdown subset, for Vault notes.
 *
 * Deliberately not a Markdown library. The Vault needs six or seven things —
 * headings, bullets, checkboxes, numbers, quotes, code, emphasis — and a real
 * parser would bring a dependency, a bundle, and a surface area of syntax
 * nobody typed on purpose. This parses to plain data; the component turns that
 * data into React elements, so a note can never produce markup. Nothing here
 * ever touches innerHTML.
 *
 * Every block keeps the source line it came from. That's what lets a checkbox
 * be tickable in the reading view: the toggle rewrites exactly one line of the
 * body and leaves the rest byte-for-byte alone.
 */

export type NoteBlock =
  | { type: 'heading';   line: number; level: 1 | 2 | 3; text: string }
  | { type: 'task';      line: number; text: string; checked: boolean }
  | { type: 'bullet';    line: number; text: string }
  | { type: 'number';    line: number; text: string; index: number }
  | { type: 'quote';     line: number; text: string }
  | { type: 'code';      line: number; text: string }
  | { type: 'divider';   line: number }
  | { type: 'paragraph'; line: number; text: string }

export type InlineToken =
  | { type: 'text';   text: string }
  | { type: 'strong'; text: string }
  | { type: 'em';     text: string }
  | { type: 'code';   text: string }
  | { type: 'link';   text: string; href: string }

const HEADING  = /^(#{1,3})\s+(.*)$/
const TASK     = /^[-*]\s+\[([ xX])\]\s*(.*)$/
const BULLET   = /^[-*]\s+(.*)$/
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/
const QUOTE    = /^>\s?(.*)$/
const DIVIDER  = /^(-{3,}|_{3,}|\*{3,})$/

/** Splits a note body into blocks, preserving each one's source line number. */
export function parseNote(body: string): NoteBlock[] {
  const lines  = body.split('\n')
  const blocks: NoteBlock[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw  = lines[i] ?? ''
    const line = raw.trimEnd()
    const text = line.trim()

    if (!text) continue

    // Fenced code runs to its closing fence, or to the end of the note if the
    // writer never closed it — an unclosed fence should still read as code
    // rather than swallowing everything into a paragraph.
    if (text.startsWith('```')) {
      const start = i
      const collected: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        collected.push(lines[i] ?? '')
        i++
      }
      blocks.push({ type: 'code', line: start, text: collected.join('\n') })
      continue
    }

    if (DIVIDER.test(text)) { blocks.push({ type: 'divider', line: i }); continue }

    const heading = HEADING.exec(text)
    if (heading) {
      blocks.push({
        type:  'heading',
        line:  i,
        level: heading[1]!.length as 1 | 2 | 3,
        text:  heading[2]!.trim(),
      })
      continue
    }

    // Checked before the plain bullet, since a task is a bullet too.
    const task = TASK.exec(text)
    if (task) {
      blocks.push({
        type:    'task',
        line:    i,
        checked: task[1]!.toLowerCase() === 'x',
        text:    task[2]!.trim(),
      })
      continue
    }

    const bullet = BULLET.exec(text)
    if (bullet) { blocks.push({ type: 'bullet', line: i, text: bullet[1]!.trim() }); continue }

    const numbered = NUMBERED.exec(text)
    if (numbered) {
      blocks.push({ type: 'number', line: i, index: Number(numbered[1]), text: numbered[2]!.trim() })
      continue
    }

    const quote = QUOTE.exec(text)
    if (quote) { blocks.push({ type: 'quote', line: i, text: quote[1]!.trim() }); continue }

    blocks.push({ type: 'paragraph', line: i, text })
  }

  return blocks
}

const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g

/**
 * Only these schemes become links.
 *
 * A note is written by the agency and can be shared into a client portal, so
 * the body is not hostile input in the usual sense — but `javascript:` in an
 * href is one paste away from being a real problem, and an allowlist costs
 * nothing. Anything else renders as the plain text it was typed as.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed
  // A bare domain is what people actually type. Assume https rather than
  // dropping the link.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed)) return `https://${trimmed}`
  return null
}

/** Splits one line of text into emphasis, code, and link tokens. */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0

  INLINE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) })

    const [, code, linkText, linkHref, strongA, strongB, emA, emB] = match
    if (code !== undefined) {
      tokens.push({ type: 'code', text: code })
    } else if (linkText !== undefined && linkHref !== undefined) {
      const href = safeHref(linkHref)
      tokens.push(href ? { type: 'link', text: linkText, href } : { type: 'text', text: match[0] })
    } else if (strongA !== undefined || strongB !== undefined) {
      tokens.push({ type: 'strong', text: (strongA ?? strongB)! })
    } else {
      tokens.push({ type: 'em', text: (emA ?? emB)! })
    }

    last = match.index + match[0].length
  }

  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) })
  return tokens.length > 0 ? tokens : [{ type: 'text', text }]
}

/**
 * Flips the checkbox on one line and returns the new body.
 *
 * Rewriting a single line rather than re-serialising the parsed blocks is what
 * keeps everything else — spacing, an unrecognised line, a half-typed thought
 * — exactly as it was written.
 */
export function toggleTask(body: string, line: number): string {
  const lines = body.split('\n')
  const target = lines[line]
  if (target === undefined) return body

  const match = /^(\s*[-*]\s+\[)([ xX])(\].*)$/.exec(target)
  if (!match) return body

  lines[line] = `${match[1]}${match[2]!.toLowerCase() === 'x' ? ' ' : 'x'}${match[3]}`
  return lines.join('\n')
}

/** How many checkboxes a note has, and how many are ticked. */
export function taskProgress(body: string): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const line of body.split('\n')) {
    const match = TASK.exec(line.trim())
    if (!match) continue
    total++
    if (match[1]!.toLowerCase() === 'x') done++
  }
  return { done, total }
}

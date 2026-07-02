'use client'

import { useCallback, useState } from 'react'
import { useTeam } from '@/hooks/useTeam'
import { formatMentionToken } from '@/utils/mentions'
import type { WorkspaceMember } from '@/types/team'

export interface MentionTrigger {
  query: string
  /** Index of the '@' in the text. */
  start: number
  /** Index right after the query (== cursor position when the trigger was detected). */
  end: number
}

/**
 * Detects an active "@query" trigger ending at `cursor`. Requires the '@' to
 * be at the start of the text or preceded by whitespace (so "email@x" never
 * triggers), and the query itself to contain no whitespace.
 */
export function detectMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  const uptoCursor = text.slice(0, cursor)
  const atIndex = uptoCursor.lastIndexOf('@')
  if (atIndex === -1) return null
  const charBefore = atIndex > 0 ? uptoCursor[atIndex - 1] : ''
  if (charBefore && /\S/.test(charBefore)) return null
  const query = uptoCursor.slice(atIndex + 1)
  if (/\s/.test(query)) return null
  return { query, start: atIndex, end: cursor }
}

/** Splices a picked member's mention token into `text` in place of the active trigger. */
export function applyMentionPick(
  text: string,
  trigger: MentionTrigger,
  member: WorkspaceMember,
): { text: string; cursor: number } {
  const name = member.name || member.email || 'Member'
  const token = formatMentionToken(name, member.user_id) + ' '
  const before = text.slice(0, trigger.start)
  const after = text.slice(trigger.end)
  return { text: before + token + after, cursor: before.length + token.length }
}

/**
 * Framework-agnostic @mention autocomplete: given the current text + cursor
 * position, tracks whether an "@query" trigger is active and filters the
 * active workspace's members by it. UI-agnostic — works for a <textarea>,
 * <input>, or a contenteditable div (the caller supplies text + cursor from
 * whatever source is appropriate).
 */
export function useMentionAutocomplete(workspaceId: string | null | undefined) {
  const { members } = useTeam(workspaceId ?? null)
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = trigger
    ? members
        .filter((m) => (m.name ?? m.email ?? '').toLowerCase().includes(trigger.query.toLowerCase()))
        .slice(0, 6)
    : []

  const onTextChange = useCallback((text: string, cursor: number) => {
    setTrigger(detectMentionTrigger(text, cursor))
    setActiveIndex(0)
  }, [])

  const close = useCallback(() => setTrigger(null), [])

  const moveActive = useCallback((delta: number) => {
    setActiveIndex((i) => {
      if (matches.length === 0) return 0
      return (i + delta + matches.length) % matches.length
    })
  }, [matches.length])

  return { trigger, matches, activeIndex, setActiveIndex, moveActive, onTextChange, close }
}

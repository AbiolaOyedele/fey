'use client'

import { suggestEmailFix } from '@/utils/email'

interface EmailTypoHintProps {
  /** The address currently in the field. */
  value: string
  /** Called with the corrected address when the suggestion is accepted. */
  onAccept: (corrected: string) => void
}

/**
 * "Did you mean …?" under an email field.
 *
 * A suggestion, never a block. The address the person typed stays exactly as
 * they left it unless they tap the correction — an unusual domain is a real
 * domain, and a checker that argues with someone who is right about their own
 * address is worse than the typo it was added to catch.
 *
 * Renders nothing when there's nothing to say, so it can sit under any email
 * input unconditionally.
 */
export default function EmailTypoHint({ value, onAccept }: EmailTypoHintProps) {
  const suggestion = suggestEmailFix(value)
  if (!suggestion) return null

  return (
    <p className="mt-1.5 text-xs text-amber-700">
      Did you mean{' '}
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        // Inline in a sentence, so the 44px target comes from the padded
        // ::after box rather than from making the text itself huge.
        className="tap-target font-semibold underline underline-offset-2 hover:text-amber-900"
      >
        {suggestion}
      </button>
      ?
    </p>
  )
}

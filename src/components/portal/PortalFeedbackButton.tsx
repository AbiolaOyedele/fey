'use client'

import { useState, useCallback } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import FeedbackDialog, { type FeedbackInput } from '@/components/ui/FeedbackDialog'

/**
 * "Send feedback" trigger for the client portal. Submits to
 * POST /api/v1/portal/feedback using the portal token, which stores the row
 * (source = 'portal') and emails the admin allowlist. Rendered in the portal
 * sidebar footer.
 */
interface PortalFeedbackButtonProps {
  subdomain: string
  accent: string
}

export default function PortalFeedbackButton({ subdomain, accent }: PortalFeedbackButtonProps) {
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(async (input: FeedbackInput): Promise<string | null> => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) return 'Please sign in again to send feedback.'
    const res = await fetch('/api/v1/portal/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      return body?.error?.message ?? 'Couldn’t send your feedback. Please try again.'
    }
    return null
  }, [subdomain])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MessageSquarePlus size={14} />
        Send feedback
      </button>

      <FeedbackDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        accent={accent}
      />
    </>
  )
}

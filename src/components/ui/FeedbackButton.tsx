'use client'

import { useState, useCallback } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/contexts/SettingsContext'
import FeedbackDialog, { type FeedbackInput } from './FeedbackDialog'

/**
 * "Send feedback" trigger for the owner app. Submits to POST /api/v1/feedback,
 * which stores the row and emails the admin allowlist. Rendered in the sidebar
 * (desktop) and the Settings page (mobile). Owner-app only — the client portal
 * uses PortalFeedbackButton.
 */
interface FeedbackButtonProps {
  /** Sidebar (desktop): show the label when the rail is expanded. */
  expanded?: boolean
  /** Render as a mobile bottom-nav icon instead of a sidebar row. */
  mobile?: boolean
}

export default function FeedbackButton({ expanded = false, mobile = false }: FeedbackButtonProps) {
  const { showToast } = useSettings()
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(async (input: FeedbackInput): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'Please sign in again to send feedback.'
    const res = await fetch('/api/v1/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      return body?.error?.message ?? 'Couldn’t send your feedback. Please try again.'
    }
    return null
  }, [])

  return (
    <>
      {mobile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Send feedback"
          className="relative flex items-center justify-center w-11 h-11 rounded-xl text-gray-400"
        >
          <MessageSquarePlus size={22} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Send feedback"
          className={`flex items-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
            expanded ? 'w-full gap-3 px-3 h-10' : 'w-10 h-10 justify-center'
          }`}
        >
          <span className="flex-shrink-0"><MessageSquarePlus size={20} /></span>
          {expanded && <span className="text-sm font-medium">Feedback</span>}
        </button>
      )}

      <FeedbackDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        onSuccess={() => showToast('Thanks — your feedback was sent.')}
      />
    </>
  )
}

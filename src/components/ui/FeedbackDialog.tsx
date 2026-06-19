'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { FeedbackType } from '@/types/feedback'

const TYPE_OPTIONS: ReadonlyArray<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'other', label: 'Other' },
]

export interface FeedbackInput {
  type: FeedbackType
  message: string
  page_url: string | null
}

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  /** Accent for the Send button. Defaults to the app accent token. */
  accent?: string
  /** Submits the feedback. Return null on success, or an error message to show. */
  onSubmit: (input: FeedbackInput) => Promise<string | null>
  /** Called once after a successful submit (e.g. to show a toast). */
  onSuccess?: () => void
}

/**
 * Context-free feedback modal — the shared form used by both the owner app
 * (FeedbackButton) and the client portal (PortalFeedbackButton). It owns the
 * form state but not auth or transport: the caller supplies `onSubmit`.
 */
export default function FeedbackDialog({ open, onClose, accent, onSubmit, onSuccess }: FeedbackDialogProps) {
  const [type, setType] = useState<FeedbackType>('feature')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Reset every time the dialog opens.
  useEffect(() => {
    if (!open) return
    setType('feature')
    setMessage('')
    setError('')
    setDone(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = useCallback(async () => {
    if (message.trim().length < 3) {
      setError('Please add a little more detail.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const errMsg = await onSubmit({
        type,
        message: message.trim(),
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
      })
      if (errMsg) { setError(errMsg); return }
      setDone(true)
      onSuccess?.()
      setTimeout(() => { onClose() }, 1200)
    } catch {
      setError('Couldn’t send your feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [type, message, onSubmit, onSuccess, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Send feedback"
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Send feedback</h2>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm text-gray-700">Thanks — your feedback was sent.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${
                    type === opt.value
                      ? 'border-gray-900 text-gray-900'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setError('') }}
              rows={5}
              placeholder="What’s working, what isn’t, or what you’d like to see…"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 resize-none"
            />

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-full disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: accent ?? 'var(--accent, #ED64A6)' }}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

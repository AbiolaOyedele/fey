'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { ToastState } from '@/components/features/ruff-tools/hooks'

interface ToastProps {
  toast: ToastState | null
  onDone: () => void
}

/**
 * Transient bottom-centre alert for in-tool feedback. A green tick means the
 * action went through; a red warning means it didn't, with plain English on why.
 */
export default function Toast({ toast, onDone }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, toast.tone === 'error' ? 5000 : 3200)
    return () => clearTimeout(t)
  }, [toast, onDone])

  const failed = toast?.tone === 'error'

  return (
    <AnimatePresence>
      {toast && (
        // One pill for the lifetime of the run of alerts — keying the outer
        // element per message left the old ones mounted, stacked on top of each
        // other. The inner content is keyed instead, so each new alert animates
        // in without the pill ever needing to exit.
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 max-w-[90vw]"
        >
          <motion.span
            key={toast.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2.5"
          >
            {failed
              ? <AlertCircle size={17} className="text-red-500 flex-shrink-0" />
              : <CheckCircle2 size={17} className="text-emerald-500 flex-shrink-0" />}
            <span className="text-xs2 font-medium text-gray-800 leading-snug">{toast.message}</span>
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

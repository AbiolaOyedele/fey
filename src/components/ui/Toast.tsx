'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '@/contexts/SettingsContext'

export default function ToastContainer() {
  const { toasts, dismissToast, settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="flex items-center gap-3 text-white px-5 py-3 rounded-2xl shadow-lg min-w-[280px] max-w-sm"
            style={{ backgroundColor: accent }}
          >
            <span className="text-sm flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick()
                  dismissToast(toast.id)
                }}
                className="text-sm font-semibold px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

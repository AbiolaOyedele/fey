'use client'

/**
 * FloatingActionMenu — a floating action button that springs open into a stack
 * of labelled actions. Adapted from chetanverma16/floating-action-menu (21st.dev)
 * and themed to the app tokens: the trigger uses the `--accent` CSS variable the
 * app already sets on the document root, items are white pills with app shadows.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FloatingActionMenuOption {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

interface FloatingActionMenuProps {
  options: FloatingActionMenuOption[]
  /** Accessible label for the trigger when closed. */
  triggerLabel?: string
  /** Overrides the default `fixed bottom-20 right-4 lg:bottom-8` positioning. */
  className?: string
}

export default function FloatingActionMenu({
  options,
  triggerLabel = 'Open quick actions',
  className,
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('fixed bottom-20 right-4 z-30 lg:bottom-8 lg:right-8', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="flex"
        >
          <Plus size={24} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="absolute bottom-16 right-0 flex flex-col items-end gap-2"
          >
            {options.map((option, index) => (
              <motion.button
                key={option.label}
                type="button"
                onClick={() => {
                  option.onClick()
                  setIsOpen(false)
                }}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24, delay: index * 0.04 }}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-gray-100 bg-white py-2.5 pl-4 pr-5 text-sm font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
              >
                {option.icon && (
                  <span className="flex-shrink-0" style={{ color: 'var(--accent, #ED64A6)' }}>
                    {option.icon}
                  </span>
                )}
                {option.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

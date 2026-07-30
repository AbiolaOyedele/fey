'use client'

import { useState, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info } from 'lucide-react'
import type { RuffTool } from '@/types/ruffTool'

interface ToolShellProps {
  tool: RuffTool
  accent: string
  onClose: () => void
  children: ReactNode
}

/**
 * Full-screen modal that hosts a single Ruff tool over the corner grid.
 * Sets `--rt-accent` for the shared primitives, carries the tool header with a
 * "How to use" detail button, and is mobile-first (full-bleed on phones,
 * a large centred card on desktop).
 */
export default function ToolShell({ tool, accent, onClose, children }: ToolShellProps) {
  const [howTo, setHowTo] = useState(false)
  const Icon = tool.icon

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center sm:justify-center sm:p-6"
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 12, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-appbg w-full sm:max-w-5xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden sm:max-h-[92vh]"
        >
          {/* Header */}
          <header className="flex-shrink-0 bg-white border-b border-gray-100 flex items-center gap-3 px-4 sm:px-6 h-16">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base text-gray-800 truncate">{tool.name}</h2>
                {tool.badge && (
                  <span className="text-3xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {tool.badge}
                  </span>
                )}
              </div>
              <p className="text-2xs text-gray-400 truncate hidden sm:block">{tool.tagline}</p>
            </div>
            <button
              onClick={() => setHowTo(true)}
              title="How to use this tool"
              aria-label="How to use this tool"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <Info size={18} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close tool"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </header>

          {/* Body — carries the accent var for the shared primitives */}
          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6"
            style={{ '--rt-accent': accent } as unknown as CSSProperties}
          >
            {children}
          </div>

          {/* How-to detail overlay */}
          <AnimatePresence>
            {howTo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHowTo(false)}
                className="absolute inset-0 z-10 bg-black/30 flex items-end sm:items-center sm:justify-center p-0 sm:p-6"
              >
                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 24, opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
                      <Info size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm text-gray-800">How to use {tool.name}</h3>
                      <p className="text-2xs text-gray-400 truncate">{tool.tagline}</p>
                    </div>
                    <button onClick={() => setHowTo(false)} aria-label="Close" className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                  <ol className="p-5 space-y-3">
                    {tool.howTo.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-600 leading-relaxed pt-0.5">{step}</p>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

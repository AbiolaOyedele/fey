'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  /** Heading — short, action-oriented (e.g. "Delete project?"). */
  title: string
  /** Plain-English explanation of the consequence. */
  message?: string
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string
  /** 'danger' styles the confirm button red (default); 'default' uses the accent. */
  tone?: 'danger' | 'default'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * App-wide confirmation dialog. Call `const confirm = useConfirm()` then
 * `if (await confirm({ title: 'Delete project?', tone: 'danger' })) { …delete… }`.
 * Guards destructive actions so a misclick never destroys data silently.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }, [])

  const danger = (options?.tone ?? 'danger') === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4"
          onMouseDown={() => settle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50' : 'bg-gray-100'}`}>
                <AlertTriangle size={18} className={danger ? 'text-red-500' : 'text-gray-500'} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">{options.title}</h2>
                {options.message && <p className="text-sm text-gray-500 mt-1">{options.message}</p>}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                autoFocus
                onClick={() => settle(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: danger ? '#EF4444' : 'var(--accent, #ED64A6)' }}
              >
                {options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/** Returns a promise-based confirm function. Throws if used outside the provider. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

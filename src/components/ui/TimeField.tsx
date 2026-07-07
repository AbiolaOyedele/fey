'use client'

import { Clock3, X } from 'lucide-react'

interface TimeFieldProps {
  /** "HH:MM" (24h) or null. */
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return t
  const hr12 = ((h + 11) % 12) + 1
  return `${hr12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Time picker matching DateField: we draw the trigger (clock icon + 12-hour
 * time or placeholder) and overlay a transparent native input, so every
 * browser shows the same calm field instead of its own `--:-- --` widget while
 * keeping the OS time picker on tap.
 */
export default function TimeField({ value, onChange, placeholder = 'Anytime', className = '' }: TimeFieldProps) {
  return (
    <div className={`relative inline-flex items-center gap-1.5 pl-2.5 ${value ? 'pr-1.5' : 'pr-2.5'} py-1.5 rounded-lg border border-gray-200 focus-within:border-gray-400 transition-colors bg-white ${className}`}>
      <Clock3 size={13} className={`flex-shrink-0 ${value ? 'text-gray-400' : 'text-gray-300'}`} />
      <span className={`text-sm whitespace-nowrap ${value ? 'text-gray-800' : 'text-gray-300'}`}>
        {value ? formatTime(value) : placeholder}
      </span>
      <input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={placeholder}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
      />
      {value && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onChange(null) }}
          title="Clear time"
          className="relative z-10 w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

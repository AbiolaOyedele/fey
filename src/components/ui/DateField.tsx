'use client'

import { Calendar, X } from 'lucide-react'

interface DateFieldProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  /** Show an inline clear button when a date is set. */
  clearable?: boolean
  className?: string
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Date picker that stays legible on iOS. A bare `<input type="date">` renders
 * as an empty, iconless box on iPhone when it has no value — so we draw the
 * trigger ourselves (icon + formatted date or placeholder) and overlay a
 * transparent native input on top, keeping the OS picker on every platform.
 */
export default function DateField({ value, onChange, placeholder = 'Pick a date', clearable = false, className = '' }: DateFieldProps) {
  return (
    <div className={`relative inline-flex items-center gap-1.5 pl-2.5 ${clearable && value ? 'pr-1.5' : 'pr-2.5'} py-1.5 rounded-lg border border-gray-200 focus-within:border-gray-400 transition-colors bg-white ${className}`}>
      <Calendar size={13} className={`flex-shrink-0 ${value ? 'text-gray-400' : 'text-gray-300'}`} />
      <span className={`text-sm whitespace-nowrap ${value ? 'text-gray-800' : 'text-gray-300'}`}>
        {value ? formatDate(value) : placeholder}
      </span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={placeholder}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
      />
      {clearable && value && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onChange(null) }}
          title="Clear date"
          className="relative z-10 w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

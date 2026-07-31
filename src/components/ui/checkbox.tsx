'use client'

import { useId, type ButtonHTMLAttributes } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type CheckboxProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'checked' | 'defaultChecked' | 'onChange'
> & {
  checked?: boolean
  indeterminate?: boolean
  disabled?: boolean
  label?: string
  onCheckedChange?: (checked: boolean) => void
  labelClassName?: string
}

/**
 * Brand-styled checkbox. Renders an accessible button (role="checkbox") so it
 * picks up the Fey accent colour instead of the grey browser default. Supports
 * checked, indeterminate, and disabled states.
 */
export function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  label,
  onCheckedChange,
  className,
  labelClassName,
  id,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  const handleToggle = () => {
    if (disabled) return
    onCheckedChange?.(!checked)
  }

  const active = checked || indeterminate

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none',
        disabled && 'cursor-not-allowed opacity-50',
        labelClassName,
      )}
    >
      <button
        id={checkboxId}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled}
        onClick={handleToggle}
        style={active ? { backgroundColor: 'var(--accent, #ED64A6)', borderColor: 'var(--accent, #ED64A6)' } : undefined}
        className={cn(
          'relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 after:absolute after:-inset-x-[11px] after:-inset-y-[3px] after:content-[""]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          active ? 'text-white' : 'border-gray-300 bg-white hover:border-[var(--accent,#ED64A6)]',
          disabled && 'cursor-not-allowed hover:border-gray-300',
          className,
        )}
        {...props}
      >
        {indeterminate ? (
          <Minus size={11} strokeWidth={3} />
        ) : checked ? (
          <Check size={11} strokeWidth={3} />
        ) : null}
      </button>

      {label ? <span>{label}</span> : null}
    </label>
  )
}

'use client'

import { useState, useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, HelpCircle } from 'lucide-react'

/**
 * Shared primitives for the Ruff Tools corner, styled in Fey's language:
 * white cards, soft gray borders, NoirPro, and the workspace accent surfaced
 * as the CSS var `--rt-accent` (set once on the corner root). Ported and
 * re-skinned from the Sahl "Winston" tools kit.
 */

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

/* ── Info tooltip ─────────────────────────────────────────────────────────── */
const TIP_WIDTH = 208 // matches w-52; needed to keep the bubble inside the viewport

interface TipPos { left: number; top?: number; bottom?: number }

/**
 * Small "?" affordance that explains a single control. Opens on hover for
 * pointers and on tap for touch, so it never depends on hover alone. The icon
 * stays visually small but carries a 44×44 hit area via negative margins.
 *
 * The bubble is rendered through a portal with fixed positioning: the controls
 * these tips sit on live inside cards, scroll containers and collapsible
 * sections that all clip their overflow, so an absolutely-positioned bubble got
 * cut off. Position is measured from the button and clamped to the viewport.
 */
export function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<TipPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const show = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.min(Math.max(r.left + r.width / 2 - TIP_WIDTH / 2, 8), window.innerWidth - TIP_WIDTH - 8)
    // Above the icon when there's room, otherwise below it.
    setPos(r.top > 96
      ? { left, bottom: window.innerHeight - r.top + 8 }
      : { left, top: r.bottom + 8 })
  }
  const hide = () => setPos(null)

  // A fixed bubble would drift away from its icon on scroll, so close instead.
  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [pos])

  return (
    <span className="inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={text}
        // Hover opens it for a mouse; tap toggles it for touch and pen. Keeping
        // the two on separate pointer types stops a tap from opening and
        // immediately closing the tip again.
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') show() }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') hide() }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') { if (pos) hide(); else show() } }}
        onFocus={show}
        onBlur={hide}
        /* 44×44 hit area, pulled back to a 20px footprint so it sits inline */
        className="inline-flex items-center justify-center w-11 h-11 -m-3 rounded-full border-none bg-transparent p-0 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
      >
        <HelpCircle size={13} />
      </button>
      {pos && createPortal(
        <AnimatePresence>
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15 }}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: TIP_WIDTH }}
            className="fixed z-[80] block rounded-lg bg-gray-900 px-2.5 py-1.5 text-3xs font-normal leading-snug text-white shadow-lg pointer-events-none"
          >
            {text}
          </motion.span>
        </AnimatePresence>,
        document.body,
      )}
    </span>
  )
}

/* ── Label ────────────────────────────────────────────────────────────────── */
export function Label({ children, hint, className = '' }: { children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-gray-700 mb-1.5 ${className}`}>
      {hint ? (
        <span className="inline-flex items-center gap-1.5">{children}<InfoTip text={hint} /></span>
      ) : (
        children
      )}
    </label>
  )
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}
export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium text-sm transition-all cursor-pointer disabled:cursor-default select-none'
  const variants: Record<string, string> = {
    primary:
      'bg-[var(--rt-accent)] text-white hover:opacity-90 disabled:opacity-40 min-h-[44px] px-4',
    secondary:
      'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800 disabled:opacity-40 min-h-[44px] px-4',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

/* ── Slider ───────────────────────────────────────────────────────────────── */
interface SliderProps {
  label?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  suffix?: string
  display?: string | number
  hint?: string
  /** Replaces the read-only value readout — e.g. with an editable field. */
  control?: ReactNode
}
export function Slider({ label, value, min, max, step = 1, onChange, suffix = '', display, hint, control }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            {label}{hint && <InfoTip text={hint} />}
          </span>
          {control ?? (
            <span className="text-2xs font-semibold text-gray-800 tabular-nums">
              {display ?? value}{suffix}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--rt-accent)]"
        style={{ background: `linear-gradient(to right, var(--rt-accent) ${pct}%, #e5e7eb ${pct}%)` }}
      />
    </div>
  )
}

/* ── Number field ─────────────────────────────────────────────────────────── */
interface NumberFieldProps {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  label: string
}
/**
 * Typed numeric entry, clamped to [min, max]. Free-form while typing so a
 * half-finished number isn't fought with, then committed on blur or Enter.
 */
export function NumberField({ value, min, max, onChange, label }: NumberFieldProps) {
  // Re-sync the draft when the value changes elsewhere (e.g. the slider).
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setDraft(String(value))
  }

  const commit = () => {
    const n = Number(draft)
    const next = Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
      className="w-16 h-11 bg-gray-50 border border-gray-200 rounded-lg px-2 text-center text-xs2 font-semibold text-gray-800 tabular-nums outline-none focus:border-gray-300"
    />
  )
}

/* ── Segmented button group ───────────────────────────────────────────────── */
type SegValue = string | number | boolean
interface SegOption<T extends SegValue> { label: string; value: T; hint?: string }
interface SegGroupProps<T extends SegValue> {
  options: ReadonlyArray<T | SegOption<T>>
  value: T
  onChange: (v: T) => void
  columns?: number
}
export function SegGroup<T extends SegValue>({ options, value, onChange, columns }: SegGroupProps<T>) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const val = (typeof opt === 'object' ? opt.value : opt) as T
        const lab = typeof opt === 'object' ? opt.label : String(opt)
        const hint = typeof opt === 'object' ? opt.hint : undefined
        const active = val === value
        return (
          <button
            key={String(val)}
            onClick={() => onChange(val)}
            title={hint}
            aria-label={hint ? `${lab} — ${hint}` : undefined}
            className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer border min-h-[40px]
              ${active
                ? 'bg-[var(--rt-accent)] text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            {lab}
          </button>
        )
      })}
    </div>
  )
}

/* ── Colour field ─────────────────────────────────────────────────────────── */
interface ColorFieldProps { label: string; value: string; onChange: (v: string) => void }
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-2xs font-mono text-gray-700 outline-none focus:border-gray-300"
        />
        <label className="w-9 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer relative flex-shrink-0">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer"
          />
        </label>
      </div>
    </div>
  )
}

/* ── Collapsible section ──────────────────────────────────────────────────── */
export function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3 border-none bg-transparent cursor-pointer"
      >
        <span className="text-xs font-semibold text-gray-800">{title}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Spinners ─────────────────────────────────────────────────────────────── */
export function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-[3px] border-gray-100" />
        <div className="absolute inset-0 rounded-full border-[3px] border-[var(--rt-accent)] border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  )
}

export function InlineSpinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
      <Loader2 size={14} className="animate-spin" /> {text}
    </div>
  )
}

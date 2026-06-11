'use client'

import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const DISMISSED_KEY = 'whats_new_dismissed_version'

interface WhatsNewEntry {
  id: string
  version: string
  title: string
  features: string[]
  created_at: string
}

interface WhatsNewPopupProps {
  open: boolean
  onClose: () => void
}

export async function fetchLatestWhatsNew(): Promise<WhatsNewEntry | null> {
  const { data, error } = await supabase
    .from('whats_new')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const raw = data as Omit<WhatsNewEntry, 'features'> & { features: string | string[] }
  return {
    ...raw,
    features: Array.isArray(raw.features)
      ? raw.features
      : (JSON.parse(raw.features || '[]') as string[]),
  }
}

export function getDismissedVersion(): string {
  return localStorage.getItem(DISMISSED_KEY) ?? ''
}

export function dismissVersion(version: string): void {
  localStorage.setItem(DISMISSED_KEY, version)
}

export default function WhatsNewPopup({ open, onClose }: WhatsNewPopupProps) {
  const [entry, setEntry] = useState<WhatsNewEntry | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    setEntry(null)
    void fetchLatestWhatsNew().then((e) => { if (e) setEntry(e) })
  }, [open])

  const handleClose = () => {
    setClosing(true)
    if (entry?.version) dismissVersion(entry.version)
    setTimeout(() => { setClosing(false); onClose() }, 200)
  }

  if (!open) return null

  const features = entry?.features ?? []
  const version  = entry?.version  ?? ''
  const title    = entry?.title    ?? 'New in Fey'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] animate-fadeIn p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${
          closing ? 'animate-scale-out' : 'animate-scale-in'
        }`}
      >
        {/* Accent header */}
        <div className="relative p-6 pb-5" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Rotating seal */}
          <div className="relative inline-flex items-center justify-center w-12 h-12 mb-4">
            <svg
              viewBox="0 0 295 295"
              className="absolute inset-0 w-full h-full animate-slow-rotate"
              fill="rgba(255,255,255,0.25)"
            >
              <path d="M280.977,118.478c-13.619-10.807-20.563-27.57-18.574-44.845c1.3-11.3-2.566-22.393-10.607-30.432
                c-8.044-8.043-19.136-11.909-30.434-10.607c-17.281,1.986-34.037-4.954-44.844-18.573C169.449,5.11,158.872,0,147.499,0
                c-11.374,0-21.951,5.11-29.021,14.02c-10.807,13.618-27.564,20.56-44.841,18.575c-11.3-1.305-22.393,2.563-30.435,10.605
                c-8.043,8.04-11.909,19.133-10.609,30.435c1.989,17.272-4.954,34.035-18.576,44.844C5.11,125.549,0,136.126,0,147.498
                s5.109,21.949,14.019,29.021c13.62,10.808,20.563,27.57,18.574,44.845c-1.3,11.3,2.566,22.393,10.607,30.432
                c8.044,8.043,19.145,11.911,30.434,10.607c17.274-1.988,34.037,4.954,44.844,18.573c7.069,8.91,17.646,14.021,29.021,14.021
                c11.373,0,21.95-5.11,29.02-14.02c10.808-13.618,27.565-20.559,44.841-18.575c11.301,1.299,22.393-2.563,30.435-10.605
                c8.043-8.04,11.909-19.133,10.609-30.434c-1.989-17.273,4.955-34.037,18.576-44.845c8.907-7.07,14.017-17.647,14.017-29.02
                S289.886,125.549,280.977,118.478z"/>
            </svg>
            <span className="relative z-10 text-white font-bold text-[10px]">New</span>
          </div>

          <p className="font-mono text-3xl font-bold text-white leading-none mb-1">
            {version ? `v${version}` : <span className="opacity-40 text-xl">Loading…</span>}
          </p>
          <p className="text-white/75 text-sm font-medium">{title}</p>
        </div>

        {/* Feature list */}
        <div className="p-6 max-h-64 overflow-y-auto">
          <ul className="space-y-2.5">
            {features.length > 0 ? (
              features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-gray-700 text-sm">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                  >
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))
            ) : (
              <li className="text-gray-400 text-sm italic">
                {entry === null ? 'Loading…' : 'No features listed'}
              </li>
            )}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

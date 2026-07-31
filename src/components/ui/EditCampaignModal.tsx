'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image } from 'lucide-react'
import { PALETTE } from '@/data/defaultClients'
import type { Campaign } from '@/types'

interface EditCampaignModalProps {
  campaign: Campaign
  onSave: (updates: { name: string; color: string; logo: string }) => void
  onClose: () => void
}

const normalizeHex = (val: string): string => {
  const trimmed = val.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

const isValidHex = (val: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val))

export default function EditCampaignModal({ campaign, onSave, onClose }: EditCampaignModalProps) {
  const [name, setName] = useState(campaign.name ?? '')
  const [selectedColor, setSelectedColor] = useState(campaign.color ?? PALETTE[0])
  const [customHex, setCustomHex] = useState('')
  const [logo, setLogo] = useState(campaign.logo ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) { alert('Image must be under 500 KB'); return }
    const reader = new FileReader()
    reader.onloadend = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCustomHexChange = (val: string) => {
    setCustomHex(val)
    if (isValidHex(val)) setSelectedColor(normalizeHex(val))
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color: selectedColor, logo })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slideUp max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Edit Campaign</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <input
          autoFocus
          type="text"
          placeholder="Campaign name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/10 mb-4"
        />

        {/* Logo upload */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Logo (optional)</p>
          <div className="flex items-center gap-3">
            {logo ? (
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  alt="Logo"
                  className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-200"
                />
                <button
                  onClick={() => setLogo('')}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} />
                </button>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                <Image size={16} />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Upload size={12} />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <span className="text-xs text-gray-400">PNG/JPG, max 500 KB</span>
          </div>
        </div>

        {/* Color picker */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Color</p>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-3">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => { setSelectedColor(color); setCustomHex('') }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-150 hover:scale-105"
                style={{
                  backgroundColor: color,
                  outline: selectedColor === color ? '3px solid #6B7280' : '3px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {customHex && isValidHex(customHex) && (
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 border border-gray-200"
                style={{ backgroundColor: normalizeHex(customHex) }}
              />
            )}
            <input
              type="text"
              placeholder="#hex color"
              value={customHex}
              onChange={(e) => handleCustomHexChange(e.target.value)}
              maxLength={7}
              className="w-32 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all"
            />
            {customHex && !isValidHex(customHex) && (
              <span className="text-xs text-danger">Invalid hex</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

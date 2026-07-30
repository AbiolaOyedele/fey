'use client'

import { useEffect, useState } from 'react'
import { Cloud, Monitor } from 'lucide-react'
import type { ChannelAvailability, GenerationChannel } from '@/types/image-pipeline'

interface ChannelSelectorProps {
  channels: ChannelAvailability[]
  value: GenerationChannel
  onChange: (channel: GenerationChannel) => void
  accent: string
}

/**
 * Channel picker. The API channel is always available and selected by default.
 * The Flow (desktop) channel is only shown on desktop pointers — mobile never
 * sees it — and is disabled while no worker is online (the mock case).
 */
export default function ChannelSelector({ channels, value, onChange, accent }: ChannelSelectorProps) {
  const isDesktop = useIsDesktopPointer()
  const flow = channels.find((c) => c.channel === 'flow')
  const showFlow = isDesktop && !!flow

  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Channel</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ChannelCard
          icon={<Cloud size={16} />}
          title="API"
          subtitle="Cloud generation"
          selected={value === 'api'}
          disabled={false}
          onClick={() => onChange('api')}
          accent={accent}
        />
        {showFlow && (
          <ChannelCard
            icon={<Monitor size={16} />}
            title="Flow (desktop)"
            subtitle={flow?.online ? 'Desktop worker online' : flow?.reason ?? 'Offline'}
            selected={value === 'flow'}
            disabled={!flow?.online}
            onClick={() => flow?.online && onChange('flow')}
            accent={accent}
          />
        )}
      </div>
    </div>
  )
}

function ChannelCard({
  icon, title, subtitle, selected, disabled, onClick, accent,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  selected: boolean
  disabled: boolean
  onClick: () => void
  accent: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors min-h-[44px] ${
        disabled
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-70'
          : selected
            ? 'bg-white'
            : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
      style={selected && !disabled ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}
      aria-pressed={selected}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}15`, color: accent }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{title}</span>
        <span className="block text-2xs text-gray-400 truncate">{subtitle}</span>
      </span>
    </button>
  )
}

/** True on desktop-class devices with a fine pointer (not touch phones). */
function useIsDesktopPointer(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}

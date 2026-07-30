'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Wrench, ArrowLeft, Search, X, ArrowRight } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/motion'
import { RUFF_TOOLS, RUFF_TOOL_GROUPS } from '@/components/features/ruff-tools/registry'
import { TOOL_COMPONENTS } from '@/components/features/ruff-tools/toolComponents'
import ToolShell from '@/components/features/ruff-tools/ToolShell'
import type { RuffTool } from '@/types/ruffTool'

/**
 * Playground · Ruff Tools — a corner of small, browser-based image and QR
 * utilities. Each tool is a card that opens in a modal; nothing leaves the
 * browser except the Watermarker's saved library (synced to the workspace).
 */
export default function RuffToolsPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<RuffTool | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? RUFF_TOOLS.filter((t) => t.name.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q))
      : RUFF_TOOLS
    return RUFF_TOOL_GROUPS
      .map((group) => ({ group, tools: matched.filter((t) => t.group === group) }))
      .filter((x) => x.tools.length > 0)
  }, [query])

  const ActiveTool = active ? TOOL_COMPONENTS[active.id] : null

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/playground" title="Back to Playground" className="text-gray-300 hover:text-gray-600 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <Wrench size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Ruff Tools</h1>
        </div>
        <p className="text-xs text-gray-400 mb-4">A pocket of quick image &amp; QR utilities — each runs right in your browser.</p>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-xl px-3 h-11 max-w-sm mb-6">
          <Search size={15} className="text-gray-300 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-300"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-600 transition-colors" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </FadeIn>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400">No tools match “{query}”.</p>
      ) : (
        <div className="space-y-8 max-w-5xl">
          {groups.map(({ group, tools }) => (
            <div key={group}>
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-3">{group}</h2>
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} accent={accent} onOpen={() => setActive(tool)} />
                ))}
              </Stagger>
            </div>
          ))}
        </div>
      )}

      {active && ActiveTool && (
        <ToolShell tool={active} accent={accent} onClose={() => setActive(null)}>
          <ActiveTool accent={accent} />
        </ToolShell>
      )}
    </div>
  )
}

function ToolCard({ tool, accent, onOpen }: { tool: RuffTool; accent: string; onOpen: () => void }) {
  const Icon = tool.icon
  return (
    <StaggerItem whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
      <div className="relative group h-full">
        <button
          onClick={onOpen}
          className="w-full h-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ ['--tw-ring-color' as string]: accent }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            <Icon size={20} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-800">{tool.name}</h3>
            {tool.badge && (
              <span className="text-3xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tool.badge}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{tool.tagline}</p>
          <span
            className="inline-flex items-center gap-1 text-xs font-medium mt-3 transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: accent }}
          >
            Open <ArrowRight size={13} />
          </span>
        </button>
      </div>
    </StaggerItem>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Images, Sparkles } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useImageGallery } from '@/hooks/useImageGallery'
import GenerationTile from '@/components/features/image-pipeline/GenerationTile'
import type { IpGeneration } from '@/types/image-pipeline'

type Filter = 'all' | 'complete' | 'pending' | 'rejected'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'complete', label: 'Finals' },
  { key: 'pending', label: 'In progress' },
  { key: 'rejected', label: 'Rejected' },
]

const PENDING_STATUSES = ['prompting', 'prompt_review', 'generating_preview', 'preview_ready', 'generating_final']

/** Gallery — finals, in-progress and rejected generations with a status filter. */
export default function ImagePipelineGalleryPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { generations, loading, error, retry } = useImageGallery()
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo<IpGeneration[]>(() => {
    if (filter === 'all') return generations
    if (filter === 'complete') return generations.filter((g) => g.status === 'complete')
    if (filter === 'rejected') return generations.filter((g) => g.status === 'rejected' || g.status === 'failed' || g.status === 'expired')
    return generations.filter((g) => PENDING_STATUSES.includes(g.status))
  }, [generations, filter])

  return (
    <div>
      {/* Filter rail */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 rounded-lg px-3.5 h-11 text-xs font-medium transition-colors ${
              filter === f.key ? 'text-white' : 'text-gray-500 bg-gray-50 hover:text-gray-800'
            }`}
            style={filter === f.key ? { backgroundColor: accent } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse" />
                <div className="h-2 w-1/2 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-rose-500">{error}</p>
      ) : shown.length === 0 ? (
        <EmptyState accent={accent} isFiltered={filter !== 'all'} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {shown.map((g) => (
            <GenerationTile key={g.id} generation={g} accent={accent} onRetry={retry} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ accent, isFiltered }: { accent: string; isFiltered: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-10 flex flex-col items-center text-center">
      <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}15`, color: accent }}>
        <Images size={22} />
      </span>
      <p className="text-sm font-medium text-gray-600">{isFiltered ? 'Nothing here yet' : 'No generations yet'}</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">Your generated images will appear here for 7 days.</p>
      {!isFiltered && (
        <Link
          href="/playground/image-pipeline"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          <Sparkles size={15} /> Generate one
        </Link>
      )}
    </div>
  )
}

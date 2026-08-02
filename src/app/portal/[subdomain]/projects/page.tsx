'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import BrandCard from '@/components/crm/BrandCard'
import { FadeIn } from '@/components/ui/motion'
import type { Project } from '@/types/project'

export default function PortalProjectsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const accent = usePortalAccent(subdomain)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }
      const res = await fetch('/api/v1/portal/projects', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const d = await res.json() as { projects: Project[] }
        setProjects(d.projects)
      }
      setLoading(false)
    })()
  }, [subdomain])

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      {/* Labelled "Brands" client-side; the route and table keep the old
          `projects` name so existing links and data are untouched. */}
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Brands</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">Each brand keeps its chat and files together.</p>
      </FadeIn>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles size={28} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">No brands yet</p>
          <p className="text-xs text-gray-400 mt-1">Brands shared with you will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-4xl">
          {projects.map((p) => (
            <BrandCard
              key={p.id}
              project={p}
              accent={accent}
              onOpen={() => router.push(`${portalBasePath(subdomain)}/projects/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

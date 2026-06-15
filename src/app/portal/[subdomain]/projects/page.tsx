'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { portalBasePath } from '@/hooks/usePortalBase'
import { formatDate } from '@/utils/formatDate'
import type { Project, ProjectStatus } from '@/types/project'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active', on_hold: 'On hold', completed: 'Completed', archived: 'Archived',
}
const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: 'bg-green-50 text-green-600',
  on_hold: 'bg-amber-50 text-amber-600',
  completed: 'bg-blue-50 text-blue-600',
  archived: 'bg-gray-100 text-gray-500',
}

export default function PortalProjectsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router = useRouter()
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-400 mt-0.5">Each project keeps its chat and files together.</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen size={32} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">No projects yet</p>
          <p className="text-xs2 text-gray-400 mt-1">Projects shared with you will appear here.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`${portalBasePath(subdomain)}/projects/${p.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h3>
                <span className={`flex-shrink-0 text-2xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              {p.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.description}</p>}
              <p className="text-2xs text-gray-400">
                {p.due_date ? `Due ${formatDate(p.due_date)}` : `Created ${formatDate(p.created_at)}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

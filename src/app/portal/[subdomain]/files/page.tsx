'use client'
import { portalTokenKey } from '@/hooks/usePortalAuth'

import { use, useState, useEffect } from 'react'
import { Folder, Download, FileText, Image, Archive } from 'lucide-react'
import type { CrmFile } from '@/types/crm'

function fileIcon(type: string | null) {
  if (!type) return <FileText size={16} />
  if (type.startsWith('image/')) return <Image size={16} />
  if (type.includes('zip') || type.includes('rar')) return <Archive size={16} />
  return <FileText size={16} />
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function PortalFilesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [files,   setFiles]   = useState<CrmFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const token = localStorage.getItem(portalTokenKey(subdomain))
      if (!token) { setLoading(false); return }
      const res = await fetch('/api/v1/portal/files', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json() as { files: CrmFile[] }
        setFiles(d.files)
      }
      setLoading(false)
    })()
  }, [subdomain])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Files</h1>
        <p className="text-sm text-gray-400 mt-0.5">{files.length} file{files.length !== 1 ? 's' : ''} shared with you</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Folder size={32} className="text-gray-200 mb-3" />
          <p className="text-[15px] font-medium text-gray-500">No files yet</p>
          <p className="text-[13px] text-gray-400 mt-1">Files shared with you will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 h-14 px-4 border-b border-gray-100 last:border-b-0">
              <span className="text-gray-400 flex-shrink-0">{fileIcon(file.file_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-gray-900 truncate">{file.file_name}</p>
                {file.file_size && <p className="text-[11px] text-gray-400">{fmtSize(file.file_size)}</p>}
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0 hidden sm:inline">
                {new Date(file.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <Download size={15} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

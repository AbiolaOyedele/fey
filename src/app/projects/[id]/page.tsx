'use client'

import { use, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, FolderOpen, Archive, ArchiveRestore } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useProject } from '@/hooks/useProjects'
import { useContacts } from '@/hooks/useCrm'
import { uploadToCloudinary } from '@/utils/cloudinary'
import MessageThread from '@/components/crm/MessageThread'
import FileList from '@/components/crm/FileList'
import type { CrmMessage, CrmFile, MessageAttachment } from '@/types/crm'

type Pane = 'chat' | 'files'

/**
 * Canonical project detail — works for personal and client-assigned projects.
 * Reached from the central /projects hub and the client Projects tab.
 */
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useSettings()
  const { canManage } = useWorkspace()
  const confirm = useConfirm()
  const { project, messages, files, loading, sendMessage, addFile, removeFile } = useProject(projectId)
  const { contacts } = useContacts()

  const client = useMemo(() => (project?.contact_id ? contacts.find((c) => c.id === project.contact_id) ?? null : null), [project?.contact_id, contacts])

  const [pane, setPane] = useState<Pane>('chat')
  const [uploading, setUploading] = useState(false)

  const threadMessages = useMemo<CrmMessage[]>(
    () => messages.map((m) => ({
      id: m.id, contact_id: m.project_id, owner_id: m.owner_id,
      sender_type: m.sender_type, sender_id: m.sender_id,
      body: m.body, body_html: m.body_html, attachments: m.attachments,
      read_at: m.read_at, created_at: m.created_at,
    })),
    [messages],
  )

  const listFiles = useMemo<CrmFile[]>(
    () => files.map((f) => ({
      id: f.id, contact_id: f.project_id, owner_id: f.owner_id, uploaded_by: f.owner_id,
      uploader_type: f.uploader_type, file_name: f.file_name, file_url: f.file_url,
      public_id: f.public_id ?? '', file_size: f.file_size, file_type: f.file_type, created_at: f.created_at,
    })),
    [files],
  )

  const handleSend = useCallback(
    (text: string, html: string, attachments: MessageAttachment[]) => sendMessage(text, html, attachments),
    [sendMessage],
  )

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const { url, publicId, size } = await uploadToCloudinary(file, 'projects').promise
      await addFile({ file_name: file.name, file_url: url, public_id: publicId, file_size: size, file_type: file.type || null })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Couldn’t upload that file. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [addFile, showToast])

  const toggleArchive = useCallback(async () => {
    if (!project) return
    // Archiving hides the project from the main list; warn first. Unarchiving is safe.
    if (!project.archived_at) {
      const ok = await confirm({
        title: 'Archive this project?',
        message: 'It will be hidden from your Projects list. You can restore it anytime from Projects → Archived.',
        confirmLabel: 'Archive',
        tone: 'default',
      })
      if (!ok) return
    }
    const { supabase } = await import('@/lib/supabase')
    const archived_at = project.archived_at ? null : new Date().toISOString()
    await supabase.from('projects').update({ archived_at, updated_at: new Date().toISOString() }).eq('id', projectId)
    router.push('/projects')
  }, [project, projectId, router, confirm])

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={15} /> Projects
          </button>
          {project && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-900 truncate">{project.title}</span>
              {client && (
                <button
                  onClick={() => router.push(`/clients/${client.id}/projects`)}
                  className="text-xs2 text-gray-400 hover:text-gray-600"
                >
                  · {client.name}
                </button>
              )}
              {!project.contact_id && <span className="text-2xs text-gray-300">· Personal</span>}
            </>
          )}
          {canManage && project && (
            <button
              onClick={() => void toggleArchive()}
              className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
            >
              {project.archived_at ? <><ArchiveRestore size={13} /> Unarchive</> : <><Archive size={13} /> Archive</>}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={() => setPane('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pane === 'chat' ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            style={pane === 'chat' ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
          >
            <MessageSquare size={13} /> Chat
          </button>
          <button
            onClick={() => setPane('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pane === 'files' ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            style={pane === 'files' ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
          >
            <FolderOpen size={13} /> Files
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-appbg">
        {pane === 'chat' ? (
          <MessageThread messages={threadMessages} ownerId={user?.id ?? ''} onSend={handleSend} loading={loading} />
        ) : (
          <div className="h-full overflow-y-auto p-4 lg:p-6">
            <FileList
              files={listFiles}
              loading={loading}
              ownerId={user?.id ?? ''}
              contactId={project?.contact_id ?? ''}
              onUpload={handleUpload}
              onDelete={(fileId) => removeFile(fileId)}
              uploading={uploading}
              canDelete={canManage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

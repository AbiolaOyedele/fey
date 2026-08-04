'use client'

import { use, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, FolderOpen, ListTodo, Archive, ArchiveRestore, ImagePlus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useProject } from '@/hooks/useProjects'
import { useContacts } from '@/hooks/useCrm'
import { useTasks } from '@/hooks/useTasks'
import { useWorkflows } from '@/hooks/useWorkflows'
import { uploadToCloudinary, validateUploadFile } from '@/utils/cloudinary'
import MessageThread from '@/components/crm/MessageThread'
import FileList from '@/components/crm/FileList'
import BrandLogo from '@/components/crm/BrandLogo'
import TaskListView from '@/components/tasks/TaskListView'
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer'
import NewTaskModal from '@/components/tasks/NewTaskModal'
import type { Task } from '@/types/work-tasks'
import type { CrmMessage, CrmFile, MessageAttachment } from '@/types/crm'

type Pane = 'chat' | 'files' | 'tasks'

/**
 * Canonical project detail — works for personal and client-assigned projects.
 * Reached from the central /projects hub and the client Projects tab.
 */
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useSettings()
  const { workspace, canManage } = useWorkspace()
  const confirm = useConfirm()
  const {
    project, messages, files, loading,
    sendMessage, deleteMessage, clearMessages, addFile, removeFile, reload,
  } = useProject(projectId)
  const { contacts } = useContacts()

  const client = useMemo(() => (project?.contact_id ? contacts.find((c) => c.id === project.contact_id) ?? null : null), [project?.contact_id, contacts])
  const accent = useSettings().settings.accent_color || '#ED64A6'

  const [pane, setPane] = useState<Pane>('chat')
  const [uploading, setUploading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  // ── Tasks on this brand ────────────────────────────────────────────────────
  // A brand had chat and files but no tasks, so the work assigned to it lived
  // only on the board — you could open a brand and not see what was owed on it.
  // Same list, same drawer, same modal as the Tasks section: one task model.
  const brandTasks = useTasks({ scope: 'project', workspaceId: workspace?.id ?? null, projectId })
  const { workflows } = useWorkflows(workspace?.id ?? null)
  const stages = useMemo(() => (workflows.find((w) => w.is_default) ?? workflows[0])?.stages ?? [], [workflows])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const liveTask = selectedTask ? (brandTasks.tasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null
  const openTaskCount = brandTasks.tasks.filter((t) => !t.done).length

  const threadMessages = useMemo<CrmMessage[]>(
    () => messages.map((m) => ({
      id: m.id, contact_id: m.project_id, owner_id: m.owner_id,
      sender_type: m.sender_type, sender_id: m.sender_id,
      body: m.body, body_html: m.body_html, attachments: m.attachments,
      read_at: m.read_at, created_at: m.created_at,
      // Brand chat has its own table without the edit/reply columns, so the
      // thread renders it as plain messages — those controls simply don't appear.
      edited_at: null, deleted_at: null, deleted_by: null, reply_to_id: null,
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

  /** Sets or replaces the brand's logo. The old asset is left to the retention
   *  sweep rather than destroyed inline — a failed cleanup must not lose the
   *  new logo the user just chose. */
  const handleLogo = useCallback(async (file: File | undefined) => {
    if (!file) return
    const problem = validateUploadFile(file)
    if (problem) { showToast(problem); return }
    if (!file.type.startsWith('image/')) { showToast('A logo needs to be an image.'); return }
    setUploadingLogo(true)
    try {
      const { url, publicId } = await uploadToCloudinary(file, 'brand-logos').promise
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase
        .from('projects')
        .update({ logo_url: url, logo_public_id: publicId, updated_at: new Date().toISOString() })
        .eq('id', projectId)
      if (error) throw error
      await reload()
      showToast('Logo updated')
    } catch {
      showToast('Couldn’t save that logo. Please try again.')
    } finally {
      setUploadingLogo(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }, [projectId, reload, showToast])

  const removeLogo = useCallback(async () => {
    const ok = await confirm({
      title: 'Remove this logo?',
      message: 'The brand falls back to its initial. You can add a logo again at any time.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    const { supabase } = await import('@/lib/supabase')
    await supabase
      .from('projects')
      .update({ logo_url: null, logo_public_id: null, updated_at: new Date().toISOString() })
      .eq('id', projectId)
    await reload()
  }, [projectId, reload, confirm])

  const toggleArchive = useCallback(async () => {
    if (!project) return
    // Archiving hides the project from the main list; warn first. Unarchiving is safe.
    if (!project.archived_at) {
      const ok = await confirm({
        title: 'Archive this brand?',
        message: 'It will be hidden from your Brands list. You can restore it anytime from Brands → Archived.',
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

  const TABS: Array<{ key: Pane; label: string; icon: typeof MessageSquare; count?: number }> = [
    { key: 'chat',  label: 'Chat',  icon: MessageSquare },
    { key: 'files', label: 'Files', icon: FolderOpen },
    { key: 'tasks', label: 'Tasks', icon: ListTodo, count: openTaskCount },
  ]

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={15} /> Brands
          </button>
          {project && (
            <>
              <span className="text-gray-300">/</span>
              <BrandLogo
                name={project.title}
                logoUrl={project.logo_url}
                accent={accent}
                className="w-7 h-7"
                rounded="rounded-lg"
                textClassName="text-2xs"
              />
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
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => logoInput.current?.click()}
                disabled={uploadingLogo}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 min-h-[44px] rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                {uploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                <span className="hidden sm:inline">{project.logo_url ? 'Replace logo' : 'Add logo'}</span>
              </button>
              {project.logo_url && (
                <button
                  onClick={() => void removeLogo()}
                  className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 min-h-[44px] rounded-lg hover:bg-gray-100"
                >
                  Remove
                </button>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleLogo(e.target.files?.[0])}
              />
              <button
                onClick={() => void toggleArchive()}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 min-h-[44px] rounded-lg hover:bg-gray-100"
              >
                {project.archived_at ? <><ArchiveRestore size={13} /> Unarchive</> : <><Archive size={13} /> Archive</>}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mt-3 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setPane(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                pane === key ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={pane === key ? { backgroundColor: accent } : {}}
            >
              <Icon size={13} /> {label}
              {!!count && <span className="opacity-70">· {count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-appbg">
        {pane === 'chat' ? (
          <MessageThread
            messages={threadMessages}
            ownerId={user?.id ?? ''}
            onSend={handleSend}
            loading={loading}
            accent={accent}
            {...(canManage ? { onDelete: deleteMessage, onClearChat: clearMessages } : {})}
          />
        ) : pane === 'files' ? (
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
        ) : (
          <div className="h-full overflow-y-auto p-4 lg:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm text-gray-400">
                {brandTasks.loading ? 'Loading…' : `${brandTasks.tasks.length} task${brandTasks.tasks.length === 1 ? '' : 's'} on this brand`}
              </p>
              {canManage && (
                <button
                  onClick={() => setShowNewTask(true)}
                  className="press flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  New task
                </button>
              )}
            </div>

            {brandTasks.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : brandTasks.error ? (
              <div className="flex flex-col items-center py-16 text-center">
                <p className="text-sm text-gray-500 mb-3">{brandTasks.error}</p>
                <button onClick={() => void brandTasks.refetch()} className="text-sm font-semibold" style={{ color: accent }}>
                  Try again
                </button>
              </div>
            ) : brandTasks.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListTodo size={28} strokeWidth={1.5} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">No tasks on this brand yet</p>
                <p className="text-xs text-gray-400 mt-1">Anything assigned to it on the board shows up here.</p>
              </div>
            ) : (
              <TaskListView
                tasks={brandTasks.tasks}
                grouped={false}
                onToggleDone={(taskId) => void brandTasks.toggleDone(taskId)}
                onOpen={setSelectedTask}
              />
            )}
          </div>
        )}
      </div>

      {liveTask && (
        <TaskDetailDrawer
          task={liveTask}
          workspaceId={workspace?.id ?? null}
          stages={stages}
          onPatch={brandTasks.patchTask}
          onSetAssignees={brandTasks.setAssignees}
          onAddSubtask={brandTasks.addSubtask}
          onToggleSubtask={brandTasks.toggleSubtask}
          onRenameSubtask={brandTasks.renameSubtask}
          onDeleteSubtask={brandTasks.deleteSubtask}
          onAddFile={brandTasks.addFile}
          onRemoveFile={brandTasks.removeFile}
          onToggleDone={(taskId) => { void brandTasks.toggleDone(taskId); setSelectedTask(null) }}
          onDelete={async (taskId) => { await brandTasks.deleteTask(taskId); setSelectedTask(null) }}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          workspaceId={workspace?.id ?? null}
          stages={stages}
          // The brand is the point of this screen, so it's pinned rather than
          // offered as a field the user could forget to set.
          fixedProjectId={projectId}
          onCreate={async (payload) => {
            const task = await brandTasks.createTask(payload)
            setSelectedTask(task)
            return task
          }}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </div>
  )
}

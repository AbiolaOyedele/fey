'use client'

import { use, useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, Edit2, Layers,
  Upload, File, FileText, Image, Folder, Loader2, Trash2,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskItem from '@/components/ui/TaskItem'
import EditCampaignModal from '@/components/ui/EditCampaignModal'
import FilePreviewModal from '@/components/ui/FilePreviewModal'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useClientFiles, type AnyFile } from '@/hooks/useClientFiles'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseData } from '@/hooks/useSupabaseData'
import { getContrastColor } from '@/utils/colorContrast'
import {
  uploadToCloudinary,
  getFileType,
  formatFileSize,
  isImageType,
  type FileType,
} from '@/utils/cloudinary'
import type { Campaign, Task, Client } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

interface TaskFilterOption {
  value: 'all' | 'overdue' | 'today' | 'tomorrow'
  label: string
}

const TASK_FILTER_OPTIONS: TaskFilterOption[] = [
  { value: 'all',      label: 'All Tasks' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'today',    label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
]

interface StatusCfg {
  label: string
  cls: string
}

const STATUS_CONFIG: Record<string, StatusCfg> = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-500' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-500' },
  amended:  { label: 'Amend',    cls: 'bg-amber-100 text-amber-700' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FileTypeIconProps {
  fileType: FileType | string
  size?: number
  className?: string
}

function FileTypeIcon({ fileType, size = 20, className = '' }: FileTypeIconProps) {
  if (fileType === 'image')    return <Image size={size} className={className} />
  if (fileType === 'pdf')      return <FileText size={size} className={className} />
  if (fileType === 'document') return <FileText size={size} className={className} />
  return <File size={size} className={className} />
}

interface SortableTaskRowProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: () => void
}

function SortableTaskRow({ task, onUpdate, onDelete }: SortableTaskRowProps) {
  const {
    setNodeRef, transform, transition, isDragging, attributes, listeners,
  } = useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        clientId={null}
        noMoney
      />
    </div>
  )
}

// ── Upload progress item ───────────────────────────────────────────────────────

interface UploadItem {
  id: string
  name: string
  progress: number
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>
}) {
  const { id: clientId, campaignId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { settings, showToast, formatMoney, convertAmount, resolveColor } = useSettings()

  // ── All hooks MUST be called before any conditional returns ──
  const { clients } = useSupabaseData(user?.id)
  const {
    campaigns,
    loading: campaignsLoading,
    updateCampaign,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addTasksBulk,
  } = useCampaigns(clientId, user?.id)

  const {
    files,
    loading: filesLoading,
    addClientFile,
    updateStatus,
    deleteFile: deleteFileRecord,
    fetchVersions,
  } = useClientFiles(clientId, { campaignId })

  const [newTask,            setNewTask]            = useState<string>('')
  const [taskFilter,         setTaskFilter]         = useState<TaskFilterOption['value']>('all')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false)
  const [filterPos,          setFilterPos]          = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [activeTab,          setActiveTab]          = useState<'tasks' | 'files'>('tasks')
  const [editModalOpen,      setEditModalOpen]      = useState<boolean>(false)
  const [uploads,            setUploads]            = useState<UploadItem[]>([])
  const [selectedFile,       setSelectedFile]       = useState<AnyFile | null>(null)

  const filterBtnRef      = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  const isDraggingRef     = useRef<boolean>(false)
  const fileInputRef      = useRef<HTMLInputElement>(null)
  // Keep a ref for allTasks so handleDragEnd (defined before guards) can access them
  const allTasksRef       = useRef<Task[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // handleDragEnd must be a useCallback at top level — cannot appear after conditional returns
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setTimeout(() => { isDraggingRef.current = false }, 500)
    if (!over || active.id === over.id) return
    const tasks = allTasksRef.current
    const oldI = tasks.findIndex((t) => t.id === active.id)
    const newI = tasks.findIndex((t) => t.id === over.id)
    if (oldI === -1 || newI === -1) return
    void reorderTasks(campaignId, arrayMove(tasks, oldI, newI).map((t) => t.id))
  }, [campaignId, reorderTasks])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target as Node)
      ) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Guards (after all hooks) ──
  const client: Client | undefined = clients?.find((c) => c.id === clientId)

  if (!client) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400">Client not found.</p>
      <button
        onClick={() => router.push('/clients')}
        className="text-sm mt-2 hover:underline text-gray-500"
      >
        Back to Clients
      </button>
    </div>
  )

  if (campaignsLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 size={24} className="animate-spin text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Loading campaign…</p>
      </div>
    </div>
  )

  const campaign: Campaign | undefined = campaigns.find((c) => c.id === campaignId)

  if (!campaign) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400 mb-2">Campaign not found.</p>
      <button
        onClick={() => router.push(`/clients/${clientId}`)}
        className="text-sm hover:underline"
        style={{ color: client.color }}
      >
        Back to {client.name}
      </button>
    </div>
  )

  // Campaign's own color drives the entire workspace
  const campaignColor = resolveColor(campaign.color || '#E9D5FF')
  const textColor     = getContrastColor(campaignColor)

  // Date helpers
  const todayStr = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  })()
  const tomorrowStr = (() => {
    const n = new Date()
    n.setDate(n.getDate() + 1)
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  })()

  const allTasks = [...(campaign.tasks ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  allTasksRef.current = allTasks // keep ref in sync for handleDragEnd

  const filterTaskList = (tasks: Task[]): Task[] => {
    if (taskFilter === 'overdue')  return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr)
    if (taskFilter === 'today')    return tasks.filter((t) => t.deadline === todayStr)
    if (taskFilter === 'tomorrow') return tasks.filter((t) => t.deadline === tomorrowStr)
    return tasks
  }

  const pendingTasks   = filterTaskList(allTasks.filter((t) => !t.done))
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done))
  const overdueTasks   = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr)

  const totalEarned  = allTasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0)
  const totalPending = allTasks.filter((t) => !t.paid && (t.amount || 0) > 0).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0)

  // ── Task handlers ──
  const handleAddTask = async (): Promise<void> => {
    if (!newTask.trim()) return
    await addTask(campaignId, newTask.trim(), settings.currency)
    setNewTask('')
  }

  const handleTaskPaste = async (e: React.ClipboardEvent<HTMLInputElement>): Promise<void> => {
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    e.preventDefault()
    await addTasksBulk(campaignId, lines, settings.currency)
    setNewTask('')
    showToast(`${lines.length} tasks added`)
  }

  const handleUpdateTask = async (updated: Task): Promise<void> => {
    await updateTask(campaignId, updated.id, {
      title:    updated.title,
      done:     updated.done,
      paid:     updated.paid,
      amount:   updated.amount,
      currency: updated.currency,
      deadline: updated.deadline,
    })
  }

  // ── File upload handlers ──
  const uploadSingleFile = async (file: File): Promise<boolean> => {
    const uploadId = `${Date.now()}-${file.name}`
    setUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }])
    try {
      const folder = `${clientId}/campaigns/${campaignId}`
      const { promise } = uploadToCloudinary(file, folder, (pct) => {
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u))
        )
      })
      const { url, publicId } = await promise
      const { error } = await addClientFile({
        client_id:     clientId,
        campaign_id:   campaignId,
        uploaded_by:   user?.id ?? null,
        uploader_name: user?.email ?? 'You',
        file_name:     file.name,
        file_url:      url,
        public_id:     publicId,
        file_size:     file.size,
        file_type:     getFileType(file.name),
        version:       1,
        status:        'pending',
        amendment_notes: null,
        parent_file_id:  null,
      })
      if (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to save file record',
        )
        return false
      }
      return true
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : `Upload failed: ${file.name}`,
      )
      return false
    } finally {
      setUploads((prev) => prev.filter((u) => u.id !== uploadId))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileList = Array.from(e.target.files ?? [])
    if (!fileList.length) return
    const results = await Promise.all(fileList.map(uploadSingleFile))
    const successCount = results.filter(Boolean).length
    if (successCount === fileList.length && fileList.length > 1) {
      showToast(`${successCount} files uploaded`)
    } else if (successCount === 1 && fileList.length === 1) {
      showToast(`"${fileList[0].name}" uploaded`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteFile = async (e: React.MouseEvent, file: AnyFile): Promise<void> => {
    e.stopPropagation()
    await deleteFileRecord(file.id, file.public_id, 'client')
    showToast(`"${file.file_name}" deleted`)
  }

  const currentFilterLabel =
    TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label ?? 'All Tasks'

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">
      {/* ── Main content ── */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        {/* Back link */}
        <button
          onClick={() => router.push(`/clients/${clientId}`)}
          className="flex items-center gap-1.5 text-sm font-medium mb-4 hover:gap-2.5 transition-all"
          style={{ color: client.color }}
        >
          <ArrowLeft size={15} />
          Back to {client.name}
        </button>

        {/* Hero header — campaign color */}
        <div
          className="rounded-2xl p-5 mb-5 overflow-hidden"
          style={{ backgroundColor: campaignColor }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/50 flex-shrink-0"
              style={{ color: textColor }}
            >
              <Layers size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="font-display text-2xl sm:text-3xl leading-tight font-bold truncate"
                style={{ color: textColor }}
              >
                {campaign.name}
              </h1>
              <p className="text-sm mt-0.5 opacity-70" style={{ color: textColor }}>
                {client.name} · Campaign · {allTasks.length} task{allTasks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium flex-shrink-0"
              style={{ color: textColor }}
            >
              <Edit2 size={13} />
              Edit
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {(['tasks', 'files'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={
                activeTab === tab
                  ? { backgroundColor: campaignColor, color: textColor }
                  : { backgroundColor: 'white', color: '#6B7280' }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tasks tab ── */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                Tasks <span className="font-normal text-gray-400">{allTasks.length} total</span>
              </p>
              <div className="relative" ref={filterBtnRef}>
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setFilterPos({ top: rect.bottom + 6, left: rect.left })
                    setFilterDropdownOpen((v) => !v)
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {currentFilterLabel} <ChevronDown size={12} />
                </button>
              </div>
            </div>

            {filterDropdownOpen && (
              <div
                ref={filterDropdownRef}
                className="fixed bg-white rounded-xl border border-gray-100 z-50 py-1 w-40 shadow-lg"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                {TASK_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTaskFilter(opt.value)
                      setFilterDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      taskFilter === opt.value ? '' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    style={taskFilter === opt.value ? { color: campaignColor } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {taskFilter === 'all' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={() => { isDraggingRef.current = true }}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pendingTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {pendingTasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdateTask}
                      onDelete={() => void deleteTask(campaignId, task.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              pendingTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdate={handleUpdateTask}
                  onDelete={() => void deleteTask(campaignId, task.id)}
                  clientId={null}
                  noMoney
                />
              ))
            )}

            {completedTasks.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-gray-400 cursor-pointer select-none list-none flex items-center gap-1.5 py-2">
                  <ChevronDown size={12} /> {completedTasks.length} completed
                </summary>
                <div className="opacity-60 mt-1">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdateTask}
                      onDelete={() => void deleteTask(campaignId, task.id)}
                      clientId={null}
                      noMoney
                    />
                  ))}
                </div>
              </details>
            )}

            {pendingTasks.length === 0 && completedTasks.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">
                No tasks yet. Add one below.
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
              <input
                type="text"
                placeholder="Add a new task…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddTask() }}
                onPaste={(e) => void handleTaskPaste(e)}
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none transition-all min-w-0"
                onFocus={(e) => { e.target.style.borderColor = campaignColor }}
                onBlur={(e) => { e.target.style.borderColor = '' }}
              />
              <button
                onClick={() => void handleAddTask()}
                disabled={!newTask.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                style={{ backgroundColor: campaignColor, color: textColor }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        )}

        {/* ── Files tab ── */}
        {activeTab === 'files' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                Files{files.length > 0 && (
                  <span className="font-normal text-gray-400"> {files.length} total</span>
                )}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: campaignColor, color: textColor }}
              >
                <Upload size={12} /> Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFileUpload(e)}
              />
            </div>

            {uploads.map((u) => (
              <div key={u.id} className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-600 truncate flex-1">{u.name}</p>
                  <span className="text-xs text-gray-400">{u.progress}%</span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${u.progress}%`, backgroundColor: campaignColor }}
                  />
                </div>
              </div>
            ))}

            {filesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-gray-300" />
              </div>
            ) : files.length === 0 && uploads.length === 0 ? (
              <div className="text-center py-10">
                <Folder size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">No files yet</p>
                <p className="text-xs text-gray-300 mt-1">Upload files to share with your client</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((file) => {
                  const cfg: StatusCfg = STATUS_CONFIG[file.status] ?? STATUS_CONFIG['pending']!
                  return (
                    <div
                      key={file.id}
                      className="bg-gray-50 rounded-xl overflow-hidden group cursor-pointer relative hover:shadow-md transition-shadow"
                      onClick={() => setSelectedFile(file)}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square flex items-center justify-center bg-gray-100 relative overflow-hidden">
                        {isImageType(file.file_type as FileType) ? (
                          <img
                            src={file.file_url}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileTypeIcon
                            fileType={file.file_type}
                            size={28}
                            className="text-gray-300"
                          />
                        )}
                        {/* Status badge */}
                        <span
                          className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}
                        >
                          {cfg.label}
                        </span>
                        {/* Version badge */}
                        {file.version > 1 && (
                          <span className="absolute top-1.5 left-1.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            v{file.version}
                          </span>
                        )}
                        {/* Delete button — appears on hover */}
                        <button
                          onClick={(e) => void handleDeleteFile(e, file)}
                          className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Delete file"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                      {/* Info */}
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-gray-700 truncate">
                          {file.file_name}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          {file.file_size ? (
                            <p className="text-[10px] text-gray-400">
                              {formatFileSize(file.file_size)}
                            </p>
                          ) : (
                            <span />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-full lg:w-[240px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto">
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${campaignColor}22` }}
              >
                <CheckCircle2 size={16} style={{ color: campaignColor }} />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">
                  {allTasks.filter((t) => t.done).length}
                </p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-gray-400" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">
                  {allTasks.filter((t) => !t.done).length}
                </p>
                <p className="text-xs text-gray-400">Pending</p>
              </div>
            </div>

            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-red-600">{overdueTasks.length}</p>
                  <p className="text-xs text-red-400">Overdue</p>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <button
                onClick={() => setActiveTab('files')}
                className="flex items-center gap-3 w-full text-left hover:bg-gray-50 rounded-xl -mx-2 px-2 py-1 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${campaignColor}22` }}
                >
                  <Folder size={16} style={{ color: campaignColor }} />
                </div>
                <div>
                  <p className="font-mono font-semibold text-gray-700">{files.length}</p>
                  <p className="text-xs text-gray-400">Files</p>
                </div>
              </button>
            )}
          </div>

          {allTasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-400">Progress</p>
                <p className="text-xs font-mono font-semibold text-gray-700">
                  {Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100)}%
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(allTasks.filter((t) => t.done).length / allTasks.length) * 100}%`,
                    backgroundColor: campaignColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {(totalEarned > 0 || totalPending > 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
            <div className="space-y-3">
              {totalEarned > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
                  <p className="font-mono text-xl font-bold text-green-600 truncate">
                    {formatMoney(totalEarned)}
                  </p>
                </div>
              )}
              {totalPending > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                  <p className="font-mono text-lg font-semibold text-amber-500 truncate">
                    {formatMoney(totalPending)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {editModalOpen && (
        <EditCampaignModal
          campaign={campaign}
          onSave={async (updates) => {
            await updateCampaign(campaignId, updates)
            setEditModalOpen(false)
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}

      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          source="client"
          onClose={() => setSelectedFile(null)}
          onStatus={async (fileId, src, status, notes) => {
            const updated = await updateStatus(fileId, src, status, notes ?? null)
            if (updated) setSelectedFile((f) => (f ? { ...f, ...updated } : null))
            return updated
          }}
          fetchVersions={fetchVersions}
        />
      )}
    </div>
  )
}

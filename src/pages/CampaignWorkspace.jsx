import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, GripVertical, Edit2, Check, Layers,
  Upload, File, FileText, Image, Folder, X, Loader2,
  Download, Trash2,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from '../components/TaskItem';
import EditCampaignModal from '../components/EditCampaignModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { useCampaigns } from '../hooks/useCampaigns';
import { useClientFiles } from '../hooks/useClientFiles';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getContrastColor } from '../utils/colorContrast';
import { uploadToCloudinary, getFileType, formatFileSize, isImageType } from '../utils/cloudinary';

const TASK_FILTER_OPTIONS = [
  { value: 'all',      label: 'All Tasks' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'today',    label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-500' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-500' },
  amended:  { label: 'Amend',    cls: 'bg-amber-100 text-amber-700' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function FileTypeIcon({ fileType, size = 20, className = '' }) {
  if (fileType === 'image')    return <Image size={size} className={className} />;
  if (fileType === 'pdf')      return <FileText size={size} className={className} />;
  if (fileType === 'document') return <FileText size={size} className={className} />;
  return <File size={size} className={className} />;
}

function SortableTaskRow({ task, onUpdate, onDelete }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes}
        clientId={null}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignWorkspace({ clients }) {
  const { id: clientId, campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, showToast, formatMoney, convertAmount } = useSettings();

  const client = clients?.find((c) => c.id === clientId);

  const { campaigns, loading: campaignsLoading, updateCampaign, addTask, updateTask, deleteTask, reorderTasks, addTasksBulk } = useCampaigns(clientId, user?.id);
  const campaign = campaigns.find((c) => c.id === campaignId);

  // Campaign's own color drives the entire workspace
  const campaignColor = campaign?.color || '#E9D5FF';
  const textColor     = getContrastColor(campaignColor);

  // ── Tasks ──
  const [newTask,   setNewTask]   = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const filterBtnRef    = useRef(null);
  const filterDropdownRef = useRef(null);
  const isDraggingRef   = useRef(false);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'files'

  // ── Edit campaign ──
  const [editModalOpen, setEditModalOpen] = useState(false);

  // ── File upload ──
  const { files, loading: filesLoading, addClientFile, updateStatus, deleteFile: deleteFileRecord, fetchVersions } = useClientFiles(clientId, { campaignId });
  const [uploads, setUploads]     = useState([]); // { id, name, progress }
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        filterDropdownRef.current && !filterDropdownRef.current.contains(e.target) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target)
      ) setFilterDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Guard: client not found ──
  if (!client) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400">Client not found.</p>
      <button onClick={() => navigate('/clients')} className="text-sm mt-2 hover:underline text-gray-500">
        Back to Clients
      </button>
    </div>
  );

  // ── Guard: still loading campaigns ──
  if (campaignsLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  );

  // ── Guard: campaign not found (after load) ──
  if (!campaign) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400">Campaign not found.</p>
      <button
        onClick={() => navigate(`/clients/${clientId}`)}
        className="text-sm mt-2 hover:underline"
        style={{ color: client.color }}
      >
        Back to {client.name}
      </button>
    </div>
  );

  // ── Date helpers ──
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();
  const tomorrowStr = (() => {
    const n = new Date(); n.setDate(n.getDate() + 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const allTasks = [...(campaign.tasks || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const filterTaskList = (tasks) => {
    if (taskFilter === 'overdue')  return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
    if (taskFilter === 'today')    return tasks.filter((t) => t.deadline === todayStr);
    if (taskFilter === 'tomorrow') return tasks.filter((t) => t.deadline === tomorrowStr);
    return tasks;
  };

  const pendingTasks   = filterTaskList(allTasks.filter((t) => !t.done));
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done));
  const overdueTasks   = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);

  const totalEarned  = allTasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0);
  const totalPending = allTasks.filter((t) => !t.paid && (t.amount || 0) > 0).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0);

  // ── Task handlers ──
  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    await addTask(campaignId, newTask.trim(), settings.currency);
    setNewTask('');
  };

  const handleTaskPaste = async (e) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    await addTasksBulk(campaignId, lines, settings.currency);
    setNewTask('');
    showToast(`${lines.length} tasks added`);
  };

  const handleUpdateTask = async (updated) => {
    await updateTask(campaignId, updated.id, {
      title: updated.title, done: updated.done, paid: updated.paid,
      amount: updated.amount, currency: updated.currency, deadline: updated.deadline,
    });
  };

  const handleDeleteTask = async (taskId) => {
    await deleteTask(campaignId, taskId);
  };

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setTimeout(() => { isDraggingRef.current = false; }, 500);
    if (!over || active.id === over.id) return;
    const oldI = allTasks.findIndex((t) => t.id === active.id);
    const newI = allTasks.findIndex((t) => t.id === over.id);
    if (oldI === -1 || newI === -1) return;
    reorderTasks(campaignId, arrayMove(allTasks, oldI, newI).map((t) => t.id));
  }, [allTasks, campaignId, reorderTasks]);

  // ── File upload handlers ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadId = Date.now().toString();
    setUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
    try {
      const folder = `workboard/${clientId}/campaigns/${campaignId}`;
      const { url, publicId } = await uploadToCloudinary(file, folder, (pct) => {
        setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: pct } : u));
      });
      await addClientFile({
        client_id: clientId,
        campaign_id: campaignId,
        uploaded_by: user?.id,
        uploader_name: user?.email || 'You',
        file_name: file.name,
        file_url: url,
        public_id: publicId,
        file_size: file.size,
        file_type: getFileType(file.name),
        version: 1,
        status: 'pending',
      });
      showToast(`"${file.name}" uploaded`);
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file) => {
    await deleteFileRecord(file.id, file.public_id, 'client');
  };

  const handleSaveEdit = async (updates) => {
    await updateCampaign(campaignId, updates);
    setEditModalOpen(false);
  };

  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label || 'All Tasks';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">
      {/* ── Main content ── */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        {/* Back link — uses client color since it navigates back to the client */}
        <button
          onClick={() => navigate(`/clients/${clientId}`)}
          className="flex items-center gap-1.5 text-sm font-medium mb-4 hover:gap-2.5 transition-all"
          style={{ color: client.color }}
        >
          <ArrowLeft size={15} />
          Back to {client.name}
        </button>

        {/* Hero header — uses CAMPAIGN color */}
        <div className="rounded-2xl p-5 mb-5 overflow-hidden" style={{ backgroundColor: campaignColor }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {/* Logo or letter avatar */}
            {campaign.logo ? (
              <img
                src={campaign.logo}
                alt={campaign.name}
                className="w-14 h-14 rounded-2xl object-contain bg-white/70 p-1 flex-shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/50 flex-shrink-0"
                style={{ color: textColor }}
              >
                <Layers size={26} />
              </div>
            )}

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

            {/* Edit button */}
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

        {/* Tabs: Tasks | Files */}
        <div className="flex gap-1 mb-4">
          {['tasks', 'files'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={activeTab === tab
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
          <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
            {/* Filter row */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                Tasks
                <span className="text-sm font-normal text-gray-400 ml-2">{allTasks.length} total</span>
              </p>
              <div className="relative" ref={filterBtnRef}>
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setFilterPos({ top: rect.bottom + 6, left: rect.left });
                    setFilterDropdownOpen((v) => !v);
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {currentFilterLabel}
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            {filterDropdownOpen && (
              <div
                ref={filterDropdownRef}
                className="fixed bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1 w-40"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                {TASK_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTaskFilter(opt.value); setFilterDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      taskFilter === opt.value ? 'text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    style={taskFilter === opt.value ? { color: campaignColor } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Pending tasks with DnD */}
            {taskFilter === 'all' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={() => { isDraggingRef.current = true; }}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={pendingTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {pendingTasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdateTask}
                      onDelete={() => handleDeleteTask(task.id)}
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
                  onDelete={() => handleDeleteTask(task.id)}
                  clientId={null}
                />
              ))
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-gray-400 cursor-pointer select-none list-none flex items-center gap-1.5 py-2">
                  <ChevronDown size={12} />
                  {completedTasks.length} completed
                </summary>
                <div className="opacity-60 mt-1">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdateTask}
                      onDelete={() => handleDeleteTask(task.id)}
                      clientId={null}
                    />
                  ))}
                </div>
              </details>
            )}

            {pendingTasks.length === 0 && completedTasks.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No tasks yet. Add one below.</p>
            )}

            {/* Add task input */}
            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
              <input
                type="text"
                placeholder="Add a new task…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                onPaste={handleTaskPaste}
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none transition-all min-w-0"
                onFocus={(e) => { e.target.style.borderColor = campaignColor; }}
                onBlur={(e) => { e.target.style.borderColor = ''; }}
              />
              <button
                onClick={handleAddTask}
                disabled={!newTask.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                style={{ backgroundColor: campaignColor, color: textColor }}
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>
        )}

        {/* ── Files tab ── */}
        {activeTab === 'files' && (
          <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                Files
                {files.length > 0 && (
                  <span className="text-sm font-normal text-gray-400 ml-2">{files.length} total</span>
                )}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: campaignColor, color: textColor }}
              >
                <Upload size={12} />
                Upload
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>

            {/* Active uploads */}
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

            {/* File grid */}
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
                  const cfg = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={file.id}
                      className="bg-gray-50 rounded-xl overflow-hidden group cursor-pointer relative"
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="aspect-square flex items-center justify-center bg-gray-100">
                        {isImageType(file.file_type) ? (
                          <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                        ) : (
                          <FileTypeIcon fileType={file.file_type} size={28} className="text-gray-300" />
                        )}
                        {/* Status badge */}
                        <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                        {/* Version badge */}
                        {file.version > 1 && (
                          <span className="absolute top-1.5 left-1.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            v{file.version}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-gray-700 truncate">{file.file_name}</p>
                        {file.file_size && (
                          <p className="text-[10px] text-gray-400">{formatFileSize(file.file_size)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-full lg:w-[240px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto">
        {/* Overview */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
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
                <p className="font-mono font-semibold text-gray-900">{allTasks.filter((t) => t.done).length}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-gray-400" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{allTasks.filter((t) => !t.done).length}</p>
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
            {/* Files count */}
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

          {/* Progress bar */}
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

        {/* Earnings */}
        {(totalEarned > 0 || totalPending > 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
            <div className="space-y-3">
              {totalEarned > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
                  <p className="font-mono text-xl font-bold text-green-600 truncate">{formatMoney(totalEarned)}</p>
                </div>
              )}
              {totalPending > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                  <p className="font-mono text-lg font-semibold text-amber-500 truncate">{formatMoney(totalPending)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit campaign modal */}
      {editModalOpen && (
        <EditCampaignModal
          campaign={campaign}
          onSave={handleSaveEdit}
          onClose={() => setEditModalOpen(false)}
        />
      )}

      {/* File preview modal */}
      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          source="client"
          onClose={() => setSelectedFile(null)}
          onStatus={async (fileId, src, status, notes) => {
            const updated = await updateStatus(fileId, src, status, notes ?? null);
            if (updated) setSelectedFile((f) => f ? { ...f, ...updated } : null);
          }}
          fetchVersions={fetchVersions}
        />
      )}
    </div>
  );
}

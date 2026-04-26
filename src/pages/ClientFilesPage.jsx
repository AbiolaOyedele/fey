import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Search, LayoutGrid, List, File, FileText,
  Image, Folder, Check, X, RotateCcw, Trash2, Loader2, AlertCircle,
  Download, Filter,
} from 'lucide-react';
import { useClientFiles } from '../hooks/useClientFiles';
import { uploadToCloudinary, getFileType, formatFileSize, isImageType, isPdfType } from '../utils/cloudinary';
import FilePreviewModal from '../components/FilePreviewModal';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-500', dot: 'bg-red-500' },
  amended:  { label: 'Amend',    cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

const TYPE_FILTERS  = ['All', 'Images', 'PDFs', 'Documents', 'Other'];
const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Declined', 'Amended'];

function FileTypeIcon({ fileType, size = 20, className = '' }) {
  if (fileType === 'image')    return <Image size={size} className={className} />;
  if (fileType === 'pdf')      return <FileText size={size} className={className} />;
  if (fileType === 'document') return <FileText size={size} className={className} />;
  return <File size={size} className={className} />;
}

function UploadProgress({ name, progress }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
        <p className="text-sm font-medium text-gray-700 truncate flex-1">{name}</p>
        <span className="text-xs text-gray-400 flex-shrink-0">{progress}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{ width: `${progress}%`, backgroundColor: 'var(--accent, #ED64A6)' }}
        />
      </div>
    </div>
  );
}

function FileCardGrid({ file, onClick, onDelete, onStatus }) {
  const cfg = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending;
  const [actionOpen, setActionOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden group flex flex-col">
      {/* Thumbnail */}
      <div
        className="relative h-36 bg-gray-50 flex items-center justify-center cursor-pointer flex-shrink-0"
        onClick={onClick}
      >
        {isImageType(file.file_type) ? (
          <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon fileType={file.file_type} size={36} className="text-gray-300" />
        )}
        {/* Version badge */}
        {file.version > 1 && (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            v{file.version}
          </span>
        )}
        {/* Status badge */}
        <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <p
          className="text-xs font-semibold text-gray-800 truncate cursor-pointer hover:text-gray-600 mb-0.5"
          onClick={onClick}
        >
          {file.file_name}
        </p>
        <p className="text-[10px] text-gray-400">
          {formatFileSize(file.file_size)}
          {file.uploader_name && ` · ${file.uploader_name}`}
        </p>

        {/* Amendment notes if any */}
        {file.amendment_notes && (
          <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1.5">
            {file.amendment_notes}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50">
          <button
            onClick={() => onStatus(file.id, file._source, 'approved')}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onStatus(file.id, file._source, 'declined')}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onClick}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
          >
            Amend
          </button>
          <button
            onClick={() => onDelete(file.id, file.public_id, file._source)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FileRowList({ file, onClick, onDelete, onStatus }) {
  const cfg = STATUS_CONFIG[file.status] || STATUS_CONFIG.pending;
  return (
    <div className="group bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
      {/* Icon / thumbnail */}
      <div
        className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0 cursor-pointer"
        onClick={onClick}
      >
        {isImageType(file.file_type) ? (
          <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
        ) : (
          <FileTypeIcon fileType={file.file_type} size={18} className="text-gray-300" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
        <p className="text-xs text-gray-400">
          {formatFileSize(file.file_size)}
          {file.uploader_name && ` · ${file.uploader_name}`}
          {file.created_at && ` · ${new Date(file.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
          {file.version > 1 && ` · v${file.version}`}
        </p>
        {file.amendment_notes && (
          <p className="text-xs text-amber-600 truncate mt-0.5">{file.amendment_notes}</p>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.cls}`}>
          {cfg.label}
        </span>
        <button
          onClick={() => onStatus(file.id, file._source, 'approved')}
          title="Approve"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-green-500 hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => onStatus(file.id, file._source, 'declined')}
          title="Decline"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={13} />
        </button>
        <button
          onClick={onClick}
          title="Amend"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <RotateCcw size={13} />
        </button>
        <a
          href={file.file_url}
          download={file.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Download size={13} />
        </a>
        <button
          onClick={() => onDelete(file.id, file.public_id, file._source)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AmendModal({ fileId, source, onConfirm, onCancel }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-display text-base font-bold text-gray-900 mb-1">Request Amend</h3>
        <p className="text-sm text-gray-500 mb-4">Describe what needs to change.</p>
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="What changes are needed…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(fileId, source, 'amended', notes)}
            disabled={!notes.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineModal({ fileId, source, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-display text-base font-bold text-gray-900 mb-1">Decline File</h3>
        <p className="text-sm text-gray-500 mb-4">Reason for declining (optional).</p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="What's wrong with this file…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(fileId, source, 'declined', reason || null)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-red-500 hover:bg-red-600 transition-colors"
          >
            Decline
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientFilesPage({ clients }) {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();

  const client = clients?.find((c) => c.id === clientId);
  const { files, loading, addClientFile, updateStatus, deleteFile, fetchVersions } = useClientFiles(clientId);

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [uploads, setUploads] = useState([]); // { id, name, progress }
  const [previewFile, setPreviewFile] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'amend'|'decline', fileId, source }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = useCallback(async (fileList) => {
    const accepted = Array.from(fileList);
    for (const file of accepted) {
      const uploadId = crypto.randomUUID();
      setUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
      try {
        const { url, publicId, size } = await uploadToCloudinary(
          file,
          `clients/${clientId}`,
          (pct) => setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: pct } : u))
        );
        await addClientFile({
          client_id: clientId,
          uploaded_by: user?.id || null,
          uploader_name: settings.full_name || user?.email || 'You',
          file_name: file.name,
          file_url: url,
          public_id: publicId,
          file_size: size || file.size,
          file_type: getFileType(file.name),
          version: 1,
          status: 'pending',
        });
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      }
    }
  }, [clientId, user, settings, addClientFile]);

  const handleStatusAction = useCallback(async (fileId, source, status, notes = null) => {
    setActionModal(null);
    await updateStatus(fileId, source, status, notes);
  }, [updateStatus]);

  const handleStatusClick = useCallback((fileId, source, status) => {
    if (status === 'declined') {
      setActionModal({ type: 'decline', fileId, source });
    } else if (status === 'amended') {
      setActionModal({ type: 'amend', fileId, source });
    } else {
      handleStatusAction(fileId, source, status);
    }
  }, [handleStatusAction]);

  const handlePreviewStatus = useCallback(async (fileId, source, status, notes) => {
    return await updateStatus(fileId, source, status, notes);
  }, [updateStatus]);

  // Filter files
  const filtered = files.filter((f) => {
    if (search && !f.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'All') {
      const map = { Images: 'image', PDFs: 'pdf', Documents: 'document' };
      if (map[typeFilter] && f.file_type !== map[typeFilter]) return false;
      if (typeFilter === 'Other' && ['image', 'pdf', 'document'].includes(f.file_type)) return false;
    }
    if (statusFilter !== 'All' && f.status !== statusFilter.toLowerCase()) return false;
    return true;
  });

  if (!client) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Client not found.</p>
        <button onClick={() => navigate('/clients')} className="mt-3 text-sm underline">Back to clients</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter max-w-6xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate(`/clients/${clientId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to {client.name}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-sm font-bold bg-white"
          style={{ color: client.color, border: `2px solid ${client.color}` }}
        >
          {client.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-gray-900 leading-tight">Files</h1>
          <p className="text-sm text-gray-400">{client.name}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Upload size={15} />
          Upload Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 transition-colors shadow-sm"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm overflow-x-auto flex-shrink-0">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === t ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={typeFilter === t ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm overflow-x-auto flex-shrink-0">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={statusFilter === s ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {s}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm flex-shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Drop zone overlay */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        className={`mb-4 border-2 border-dashed rounded-2xl transition-all ${
          dragOver ? 'border-pink-300 bg-pink-50 py-6' : 'border-transparent py-0'
        }`}
      >
        {dragOver && (
          <div className="flex flex-col items-center gap-2 text-pink-400">
            <Upload size={28} />
            <p className="text-sm font-medium">Drop files to upload</p>
          </div>
        )}
      </div>

      {/* Active uploads */}
      {uploads.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploads.map((u) => <UploadProgress key={u.id} name={u.name} progress={u.progress} />)}
        </div>
      )}

      {/* File grid / list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Folder size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-600">
            {files.length === 0 ? 'No files yet' : 'No files match your filters'}
          </p>
          <p className="text-sm mt-1">
            {files.length === 0
              ? 'Upload files to start sharing with your client.'
              : 'Try adjusting your search or filters.'}
          </p>
          {files.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Upload Now
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((f) => (
            <FileCardGrid
              key={f.id}
              file={f}
              onClick={() => setPreviewFile(f)}
              onDelete={deleteFile}
              onStatus={handleStatusClick}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <FileRowList
              key={f.id}
              file={f}
              onClick={() => setPreviewFile(f)}
              onDelete={deleteFile}
              onStatus={handleStatusClick}
            />
          ))}
        </div>
      )}

      {/* File preview modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          source={previewFile._source}
          onClose={() => setPreviewFile(null)}
          onStatus={handlePreviewStatus}
          fetchVersions={fetchVersions}
        />
      )}

      {/* Amend modal */}
      {actionModal?.type === 'amend' && (
        <AmendModal
          fileId={actionModal.fileId}
          source={actionModal.source}
          onConfirm={handleStatusAction}
          onCancel={() => setActionModal(null)}
        />
      )}

      {/* Decline modal */}
      {actionModal?.type === 'decline' && (
        <DeclineModal
          fileId={actionModal.fileId}
          source={actionModal.source}
          onConfirm={handleStatusAction}
          onCancel={() => setActionModal(null)}
        />
      )}
    </div>
  );
}

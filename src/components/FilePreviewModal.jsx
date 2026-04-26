import { useState, useEffect } from 'react';
import { X, Download, Check, AlertCircle, RotateCcw, ChevronDown, Clock, FileText, Image, File, Loader2, History, Film } from 'lucide-react';
import { formatFileSize, isImageType, isPdfType } from '../utils/cloudinary';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-600' },
  amended:  { label: 'Amend',    cls: 'bg-amber-100 text-amber-700' },
};

function FilePreview({ file }) {
  if (!file) return null;
  if (isImageType(file.file_type)) {
    return (
      <img
        src={file.file_url}
        alt={file.file_name}
        className="w-full h-full object-contain rounded-xl"
      />
    );
  }
  if (isPdfType(file.file_type)) {
    return (
      <iframe
        src={file.file_url}
        title={file.file_name}
        className="w-full h-full rounded-xl border-0"
      />
    );
  }
  if (file.file_type === 'video') {
    return (
      <video
        src={file.file_url}
        controls
        className="w-full h-full rounded-xl object-contain bg-black"
      >
        Your browser does not support video playback.
      </video>
    );
  }
  // Generic: document / spreadsheet / other — show download prompt
  const iconMap = {
    document:    <FileText size={52} strokeWidth={1} className="text-blue-300" />,
    spreadsheet: <FileText size={52} strokeWidth={1} className="text-green-300" />,
    video:       <Film     size={52} strokeWidth={1} className="text-purple-300" />,
  };
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
      {iconMap[file.file_type] || <File size={52} strokeWidth={1} />}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">{file.file_name}</p>
        <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.file_size)}</p>
        <p className="text-xs text-gray-300 mt-0.5 capitalize">{file.file_type} file — preview not available</p>
      </div>
      <a
        href={file.file_url}
        target="_blank"
        rel="noopener noreferrer"
        download={file.file_name}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <Download size={14} />
        Download to view
      </a>
    </div>
  );
}

function DeclinePrompt({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">Reason for declining (optional)</p>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Explain what's wrong with this file…"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(reason || null)}
          className="flex-1 py-2 rounded-xl text-white text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AmendPrompt({ onConfirm, onCancel }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">What needs to be amended?</p>
      <textarea
        autoFocus
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Describe what changes are needed…"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-gray-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(notes)}
          disabled={!notes.trim()}
          className="flex-1 py-2 rounded-xl text-white text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          Request Amend
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Full file preview modal with approve/decline/amend actions and version history.
 * Props:
 *   file       – the file record
 *   source     – 'client' | 'task'
 *   onClose    – close handler
 *   onStatus   – (fileId, source, status, notes?) called after status change
 *   fetchVersions – async fn(fileId, source) → version array
 */
export default function FilePreviewModal({ file, source, onClose, onStatus, fetchVersions }) {
  const [action, setAction] = useState(null); // 'decline' | 'amend'
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState(file);

  // Load version history when toggled
  useEffect(() => {
    if (!showHistory || !fetchVersions) return;
    setVersionsLoading(true);
    fetchVersions(file.id, source).then((vs) => {
      setVersions(vs);
      setVersionsLoading(false);
    });
  }, [showHistory, file.id, source, fetchVersions]);

  const handleStatus = async (status, notes = null) => {
    setSaving(true);
    const updated = await onStatus(file.id, source, status, notes);
    if (updated) setCurrentFile({ ...currentFile, status, amendment_notes: notes });
    setSaving(false);
    setAction(null);
  };

  if (!file) return null;

  const statusCfg = STATUS_CONFIG[currentFile.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-sm font-semibold text-gray-900 truncate">{currentFile.file_name}</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
              {currentFile.version > 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  v{currentFile.version}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatFileSize(currentFile.file_size)}
              {currentFile.uploader_name && ` · Uploaded by ${currentFile.uploader_name}`}
              {currentFile.created_at && ` · ${new Date(currentFile.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={currentFile.file_url}
              download={currentFile.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Preview area */}
          <div className="flex-1 p-4 overflow-hidden bg-gray-50">
            <FilePreview file={currentFile} />
          </div>

          {/* Right panel — actions + notes + history */}
          <div className="w-64 border-l border-gray-100 flex flex-col overflow-y-auto flex-shrink-0">

            {/* Amendment notes */}
            {currentFile.amendment_notes && (
              <div className="px-4 pt-4 pb-3">
                <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Amendment notes
                </p>
                <p className="text-xs text-gray-600 bg-amber-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                  {currentFile.amendment_notes}
                </p>
              </div>
            )}

            {/* Status actions */}
            <div className="px-4 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>

              {action === 'decline' ? (
                <DeclinePrompt
                  onConfirm={(reason) => handleStatus('declined', reason)}
                  onCancel={() => setAction(null)}
                />
              ) : action === 'amend' ? (
                <AmendPrompt
                  onConfirm={(notes) => handleStatus('amended', notes)}
                  onCancel={() => setAction(null)}
                />
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => handleStatus('approved')}
                    disabled={saving || currentFile.status === 'approved'}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setAction('decline')}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    <X size={14} />
                    Decline
                  </button>
                  <button
                    onClick={() => setAction('amend')}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw size={14} />
                    Request Amend
                  </button>
                </div>
              )}
            </div>

            {/* Version history */}
            {fetchVersions && (
              <div className="px-4 py-4">
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-full"
                >
                  <History size={12} />
                  Version History
                  <ChevronDown size={12} className={`ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {versionsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 size={11} className="animate-spin" /> Loading…
                      </div>
                    ) : versions.length === 0 ? (
                      <p className="text-xs text-gray-400">Only one version.</p>
                    ) : (
                      versions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setCurrentFile({ ...v, _source: source })}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                            currentFile.id === v.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-700">v{v.version}</span>
                            <span className={`px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_CONFIG[v.status]?.cls}`}>
                              {v.status}
                            </span>
                          </div>
                          <p className="text-gray-400 mt-0.5">
                            {new Date(v.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            {v.uploader_name && ` · ${v.uploader_name}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

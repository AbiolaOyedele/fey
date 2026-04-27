import { useRef, useCallback, useState } from 'react';
import { Upload, Trash2, Loader2, File, Image, FileText, X } from 'lucide-react';
import { uploadToCloudinary, getFileType, formatFileSize, isImageType } from '../utils/cloudinary';
import { useTaskFiles } from '../hooks/useTaskFiles';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const STATUS_STYLES = {
  pending:  'bg-gray-100 text-gray-500',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-500',
  amended:  'bg-amber-100 text-amber-700',
};
const STATUS_LABELS = {
  pending:  'Pending',
  approved: 'Approved',
  declined: 'Declined',
  amended:  'Amend',
};

function FileTypeIcon({ fileType, size = 14 }) {
  if (fileType === 'image') return <Image size={size} />;
  if (fileType === 'pdf' || fileType === 'document') return <FileText size={size} />;
  return <File size={size} />;
}

/**
 * Inline file panel rendered below a task row when the paperclip is clicked.
 * Props:
 *   taskId     – the task UUID
 *   clientId   – the client UUID (for Cloudinary folder + DB column)
 *   open       – whether the panel is visible (controlled by parent)
 */
export default function TaskFileAttachment({ taskId, clientId, open }) {
  const { user } = useAuth();
  const { settings, showToast } = useSettings();
  const { files, loading, addFile, deleteFile } = useTaskFiles(taskId, open);
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const abortsRef = useRef({});

  const handleFiles = useCallback(async (fileList) => {
    const accepted = Array.from(fileList);
    for (const file of accepted) {
      const uid = crypto.randomUUID();
      setUploads((p) => [...p, { id: uid, name: file.name, progress: 0 }]);
      const { promise, abort } = uploadToCloudinary(
        file,
        `tasks/${taskId}`,
        (pct) => setUploads((p) => p.map((u) => u.id === uid ? { ...u, progress: pct } : u))
      );
      abortsRef.current[uid] = abort;
      try {
        const { url, publicId, size } = await promise;
        const { error } = await addFile({
          task_id: taskId,
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
        if (error) showToast?.(`Failed to save "${file.name}": ${error.message}`);
      } catch (err) {
        if (err.message !== 'cancelled') showToast?.(`Upload failed: ${err.message}`);
      } finally {
        delete abortsRef.current[uid];
        setUploads((p) => p.filter((u) => u.id !== uid));
      }
    }
  }, [taskId, clientId, user, settings, addFile]);

  const cancelUpload = useCallback((uid) => {
    abortsRef.current[uid]?.();
  }, []);

  if (!open) return null;

  return (
    <div className="mx-4 mb-2 ml-10 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
      {/* Drop / browse zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
          dragOver ? 'bg-gray-100' : 'hover:bg-gray-100'
        }`}
      >
        <Upload size={13} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500">
          Drop or{' '}
          <span className="font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>
            browse files
          </span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Active uploads */}
      {uploads.map((u) => (
        <div key={u.id} className="flex items-center gap-2 px-4 py-2 border-t border-gray-100">
          <Loader2 size={12} className="animate-spin text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 flex-1 truncate">{u.name}</span>
          <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${u.progress}%`, backgroundColor: 'var(--accent, #ED64A6)' }}
            />
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{u.progress}%</span>
          <button
            onClick={() => cancelUpload(u.id)}
            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
            title="Cancel upload"
          >
            <X size={11} />
          </button>
        </div>
      ))}

      {/* File list */}
      {loading ? (
        <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100">
          <Loader2 size={11} className="animate-spin" /> Loading…
        </div>
      ) : files.length > 0 ? (
        <div className="border-t border-gray-100">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 transition-colors">
              {isImageType(f.file_type) ? (
                <img src={f.file_url} alt={f.file_name}
                  className="w-7 h-7 rounded-lg object-cover flex-shrink-0 bg-white" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 text-gray-400 border border-gray-100">
                  <FileTypeIcon fileType={f.file_type} />
                </div>
              )}
              <a
                href={f.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-xs font-medium text-gray-700 hover:underline truncate"
              >
                {f.file_name}
              </a>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {f.status !== 'pending' && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[f.status]}`}>
                    {STATUS_LABELS[f.status] || f.status}
                  </span>
                )}
                <span className="text-[10px] text-gray-400">{formatFileSize(f.file_size)}</span>
                <button
                  onClick={() => deleteFile(f.id, f.public_id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <p className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">No attachments yet.</p>
      ) : null}
    </div>
  );
}

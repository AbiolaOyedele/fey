import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Upload, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isImageType } from '../utils/cloudinary';

/**
 * Summary card shown in the ClientWorkspace right sidebar below Members.
 * Shows total file count + up to 4 thumbnail previews + "View All" button.
 */
export default function ClientFilesCard({ clientId }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    async function load() {
      setLoading(true);
      const [cf, tf] = await Promise.all([
        supabase
          .from('client_files')
          .select('id, file_url, file_type, file_name')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('task_files')
          .select('id, file_url, file_type, file_name')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
      ]);

      // Count totals separately
      const [cfCount, tfCount] = await Promise.all([
        supabase.from('client_files').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('task_files').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);

      setTotal((cfCount.count || 0) + (tfCount.count || 0));

      // Combine and take first 4
      const combined = [
        ...(cf.data || []),
        ...(tf.data || []),
      ].slice(0, 4);
      setFiles(combined);
      setLoading(false);
    }
    load();
  }, [clientId]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-700">Files</p>
          {total > 0 && (
            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{total}</span>
          )}
        </div>
        <button
          onClick={() => navigate(`/clients/${clientId}/files`)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Upload size={11} />
          Upload
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-5">
          <Folder size={22} className="mx-auto text-gray-200 mb-2" />
          <p className="text-xs text-gray-400">No files yet</p>
          <p className="text-xs text-gray-300 mt-0.5">Upload files to share with your client</p>
        </div>
      ) : (
        <>
          {/* Thumbnail grid */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {files.map((f) => (
              <div
                key={f.id}
                className="aspect-square rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
              >
                {isImageType(f.file_type) ? (
                  <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover" />
                ) : (
                  <Folder size={16} className="text-gray-300" />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate(`/clients/${clientId}/files`)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors"
          >
            View All Files
            <ArrowRight size={12} />
          </button>
        </>
      )}
    </div>
  );
}

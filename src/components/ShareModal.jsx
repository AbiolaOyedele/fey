import { useState, useEffect } from 'react';
import { X, Copy, Check, Link2, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

export default function ShareModal({ client, userId, onClose }) {
  const { settings } = useSettings();
  const [shareRecord, setShareRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from('shared_clients')
        .select('*')
        .eq('client_id', client.id)
        .eq('owner_id', userId)
        .eq('active', true)
        .maybeSingle();
      setShareRecord(data || null);
      setLoading(false);
    }
    fetch();
  }, [client.id, userId]);

  const shareLink = shareRecord
    ? `${window.location.origin}/share/${shareRecord.token}`
    : null;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    const ownerName = settings.username || settings.company_name || 'Someone';
    const { data, error: err } = await supabase
      .from('shared_clients')
      .insert({
        client_id: client.id,
        owner_id: userId,
        owner_name: ownerName,
        permission: 'view',           // always starts as view-only
        active: true,
        // Cache client info so share page doesn't need clients RLS
        client_name: client.name,
        client_color: client.color,
        client_logo: client.logo || '',
      })
      .select()
      .single();
    if (err) { setError(err.message); setCreating(false); return; }
    setShareRecord(data);
    setCreating(false);
  };

  const handleRevoke = async () => {
    if (!shareRecord) return;
    setRevoking(true);
    await supabase
      .from('shared_clients')
      .update({ active: false })
      .eq('id', shareRecord.id);
    setShareRecord(null);
    setRevoking(false);
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold overflow-hidden"
              style={{ backgroundColor: client.color }}
            >
              {client.logo
                ? <img src={client.logo} alt="" className="w-8 h-8 object-contain" />
                : <span style={{ color: '#374151' }}>{client.name.charAt(0)}</span>}
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-gray-900">Share {client.name}</h2>
              <p className="text-xs text-gray-400">Recipients get view-only access by default</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : shareRecord ? (
            <>
              {/* Link */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Shareable Link</p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                  <p className="flex-1 text-xs text-gray-600 truncate font-mono">{shareLink}</p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                    style={copied
                      ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                      : { backgroundColor: 'var(--accent, #ED64A6)20', color: 'var(--accent, #ED64A6)' }}
                  >
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  You can grant edit access to individual members from the Members panel on this client page.
                </p>
              </div>

              {/* Revoke */}
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Revoke Link
              </button>
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--accent, #ED64A6)15' }}>
                <Link2 size={20} style={{ color: 'var(--accent, #ED64A6)' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Generate a shareable link</p>
                <p className="text-xs text-gray-400 mt-1">Recipients can view tasks. You control who can edit.</p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white mx-auto transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                <Link2 size={14} />
                Create Link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

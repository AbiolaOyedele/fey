import { useState, useEffect } from 'react';
import { X, Copy, Check, Link2, Trash2, Eye, Edit3, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

export default function ShareModal({ client, userId, onClose }) {
  const { settings } = useSettings();
  const [shareRecord, setShareRecord] = useState(null);
  const [permission, setPermission] = useState('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Fetch existing share record for this client
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
      if (data) {
        setShareRecord(data);
        setPermission(data.permission);
      }
      setLoading(false);
    }
    fetch();
  }, [client.id, userId]);

  const shareLink = shareRecord
    ? `${window.location.origin}/share/${shareRecord.token}`
    : null;

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    const ownerName = settings.username || settings.company_name || 'Someone';
    const { data, error: err } = await supabase
      .from('shared_clients')
      .insert({
        client_id: client.id,
        owner_id: userId,
        owner_name: ownerName,
        permission,
        active: true,
      })
      .select()
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    setShareRecord(data);
    setSaving(false);
  };

  const handleUpdatePermission = async (newPerm) => {
    setPermission(newPerm);
    if (!shareRecord) return;
    setSaving(true);
    await supabase
      .from('shared_clients')
      .update({ permission: newPerm })
      .eq('id', shareRecord.id);
    setShareRecord((prev) => ({ ...prev, permission: newPerm }));
    setSaving(false);
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
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: client.color, color: '#374151' }}
            >
              {client.logo
                ? <img src={client.logo} alt="" className="w-8 h-8 rounded-xl object-contain" />
                : client.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-gray-900">Share {client.name}</h2>
              <p className="text-xs text-gray-400">Let others view or collaborate</p>
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
          ) : (
            <>
              {/* Permission cards */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Permission</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'view', label: 'View Only', icon: Eye, desc: 'Can see tasks but not edit' },
                    { value: 'edit', label: 'View & Edit', icon: Edit3, desc: 'Can toggle & add tasks' },
                  ].map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      onClick={() => handleUpdatePermission(value)}
                      className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 text-left transition-all ${
                        permission === value
                          ? 'border-current'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                      style={permission === value ? { borderColor: 'var(--accent, #ED64A6)' } : {}}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={permission === value ? { backgroundColor: 'var(--accent, #ED64A6)20' } : { backgroundColor: '#F3F4F6' }}
                      >
                        <Icon size={14} style={permission === value ? { color: 'var(--accent, #ED64A6)' } : { color: '#9CA3AF' }} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${permission === value ? '' : 'text-gray-700'}`}
                          style={permission === value ? { color: 'var(--accent, #ED64A6)' } : {}}>
                          {label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Link section */}
              {shareRecord ? (
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
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-400 mb-4">No link generated yet</p>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white mx-auto transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    <Link2 size={14} />
                    Generate Link
                  </button>
                </div>
              )}

              {error && <p className="text-xs text-red-500 text-center">{error}</p>}

              {/* Revoke */}
              {shareRecord && (
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Revoke Link
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

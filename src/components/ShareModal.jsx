import { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Link2, Trash2, Loader2, Plus, KeyRound, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

// Generate a readable invite code — 4+4 uppercase alphanumeric, no 0/O/I/1
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}`;
}

export default function ShareModal({ client, userId, onClose }) {
  const { settings } = useSettings();
  const [shareRecord, setShareRecord] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null); // code id that was just copied
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [error, setError] = useState('');
  const labelRef = useRef(null);

  // Fetch share record + invite codes
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const { data: share } = await supabase
        .from('shared_clients')
        .select('*')
        .eq('client_id', client.id)
        .eq('owner_id', userId)
        .eq('active', true)
        .maybeSingle();
      setShareRecord(share || null);

      if (share) {
        const { data: codes } = await supabase
          .from('shared_client_invites')
          .select('*')
          .eq('shared_client_id', share.id)
          .order('created_at', { ascending: false });
        setInvites(codes || []);
      }
      setLoading(false);
    }
    fetchAll();
  }, [client.id, userId]);

  useEffect(() => {
    if (showLabelInput && labelRef.current) labelRef.current.focus();
  }, [showLabelInput]);

  const shareLink = shareRecord
    ? `${window.location.origin}/share/${shareRecord.token}`
    : null;

  // Create the share link
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
        permission: 'view',
        active: true,
        client_name: client.name,
        client_color: client.color,
        client_logo: client.logo || '',
      })
      .select()
      .single();
    if (err) { setError(err.message); setCreating(false); return; }
    setShareRecord(data);
    setInvites([]);
    setCreating(false);
  };

  // Revoke entire share link
  const handleRevokeLink = async () => {
    if (!shareRecord) return;
    setRevoking(true);
    await supabase.from('shared_clients').update({ active: false }).eq('id', shareRecord.id);
    setShareRecord(null);
    setInvites([]);
    setRevoking(false);
  };

  // Generate a new invite code
  const handleGenerateCode = async () => {
    if (!shareRecord) return;
    setGeneratingCode(true);
    const code = generateCode();
    const { data, error: err } = await supabase
      .from('shared_client_invites')
      .insert({
        shared_client_id: shareRecord.id,
        code,
        label: labelInput.trim(),
        status: 'pending',
      })
      .select()
      .single();
    if (!err && data) {
      setInvites((prev) => [data, ...prev]);
      setLabelInput('');
      setShowLabelInput(false);
    }
    if (err) setError(err.message);
    setGeneratingCode(false);
  };

  // Revoke a single invite code
  const handleRevokeCode = async (invite) => {
    await supabase
      .from('shared_client_invites')
      .update({ status: 'revoked' })
      .eq('id', invite.id);
    setInvites((prev) =>
      prev.map((inv) => inv.id === invite.id ? { ...inv, status: 'revoked' } : inv)
    );
    // Also kick the member if this code was used
    if (invite.member_id) {
      await supabase.from('shared_client_members').delete().eq('id', invite.member_id);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = async (invite) => {
    await navigator.clipboard.writeText(invite.code);
    setCopiedCode(invite.id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Smart link — code embedded so receiver just enters their name
  const smartLink = (invite) => `${shareLink}?code=${invite.code}`;

  const handleCopyInvite = async (invite) => {
    await navigator.clipboard.writeText(smartLink(invite));
    setCopiedCode(invite.id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const statusBadge = (invite) => {
    if (invite.status === 'revoked') return { label: 'Revoked', bg: '#FEF2F2', color: '#EF4444' };
    if (invite.status === 'used') return { label: `Used${invite.member_name ? ` · ${invite.member_name}` : ''}`, bg: '#D1FAE5', color: '#065F46' };
    return { label: 'Pending', bg: '#F3F4F6', color: '#6B7280' };
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: client.color }}
            >
              {client.logo
                ? <img src={client.logo} alt="" className="w-8 h-8 object-contain" />
                : <span style={{ color: '#374151' }}>{client.name.charAt(0)}</span>}
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-gray-900">Share {client.name}</h2>
              <p className="text-xs text-gray-400">Generate a unique link per person — code included</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : !shareRecord ? (
            /* ── No link yet ── */
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--accent, #ED64A6)15' }}>
                <Link2 size={20} style={{ color: 'var(--accent, #ED64A6)' }} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Create a shareable link</p>
                <p className="text-xs text-gray-400 mt-1">Then generate unique invite codes for each person.</p>
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
          ) : (
            <>
              {/* ── Share Link ── */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Shareable Link</p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                  <p className="flex-1 text-xs text-gray-600 truncate font-mono">{shareLink}</p>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                    style={copiedLink
                      ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                      : { backgroundColor: 'var(--accent, #ED64A6)15', color: 'var(--accent, #ED64A6)' }}
                  >
                    {copiedLink ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-gray-100" />

              {/* ── Invite Codes ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invite Codes</p>
                    <p className="text-xs text-gray-400 mt-0.5">Each generates a smart link — code is pre-filled for the receiver.</p>
                  </div>
                  <button
                    onClick={() => setShowLabelInput((v) => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                  >
                    <Plus size={12} />
                    Generate
                  </button>
                </div>

                {/* Label input + generate */}
                {showLabelInput && (
                  <div className="flex items-center gap-2 mb-3 animate-fadeIn">
                    <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      <Tag size={12} className="text-gray-400 flex-shrink-0" />
                      <input
                        ref={labelRef}
                        type="text"
                        placeholder="Label (e.g. For John) — optional"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateCode()}
                        className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                      />
                    </div>
                    <button
                      onClick={handleGenerateCode}
                      disabled={generatingCode}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                    >
                      {generatingCode ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                      Create
                    </button>
                  </div>
                )}

                {/* Codes list */}
                {invites.length === 0 ? (
                  <div className="text-center py-6 rounded-xl border border-dashed border-gray-200">
                    <KeyRound size={18} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">No invite codes yet.</p>
                    <p className="text-xs text-gray-300 mt-0.5">Generate one for each person you want to invite.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => {
                      const badge = statusBadge(invite);
                      const isCopied = copiedCode === invite.id;
                      const isActive = invite.status !== 'revoked';
                      return (
                        <div
                          key={invite.id}
                          className={`rounded-xl border p-3 transition-all ${isActive ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {/* Code */}
                            <span className="font-mono text-sm font-bold tracking-widest text-gray-800 flex-1">
                              {invite.code}
                            </span>
                            {/* Status badge */}
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: badge.bg, color: badge.color }}
                            >
                              {badge.label}
                            </span>
                          </div>

                          {/* Label */}
                          {invite.label && (
                            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                              <Tag size={10} />
                              {invite.label}
                            </p>
                          )}

                          {/* Smart link preview */}
                          {isActive && (
                            <p className="text-[10px] text-gray-400 font-mono truncate mb-2">
                              …/share/{shareRecord?.token}?code={invite.code}
                            </p>
                          )}

                          {/* Actions */}
                          {isActive && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopyInvite(invite)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                                style={isCopied
                                  ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                                  : { backgroundColor: 'var(--accent, #ED64A6)15', color: 'var(--accent, #ED64A6)' }}
                              >
                                {isCopied ? <Check size={9} /> : <Copy size={9} />}
                                {isCopied ? 'Copied!' : 'Copy link'}
                              </button>
                              <button
                                onClick={() => handleRevokeCode(invite)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-50 text-red-400 hover:bg-red-100 transition-colors ml-auto"
                              >
                                <Trash2 size={9} />
                                Revoke
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Revoke entire link ── */}
              <button
                onClick={handleRevokeLink}
                disabled={revoking}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Revoke Entire Link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

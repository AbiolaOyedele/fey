import { useState, useCallback } from 'react';
import { X, Mail, Link2, FileDown, Copy, Check, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function InvoiceSendModal({ invoice, onShareUpdate, onSaveShare, userId, onClose }) {
  const [notice, setNotice] = useState(null);
  const showToast = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };
  const [tab, setTab] = useState('email');

  // Email tab state
  const [emailTo, setEmailTo] = useState(invoice?.bill_to?.email || '');
  const [emailSubject, setEmailSubject] = useState(`Invoice ${invoice?.invoice_number || ''}`);
  const [emailBody, setEmailBody] = useState(
    `Hi ${invoice?.bill_to?.name || 'there'},\n\nPlease find attached invoice ${invoice?.invoice_number || ''} for your review.\n\nThank you for your business!\n\n${invoice?.from_details?.name || ''}`
  );
  const [sendingEmail, setSendingEmail] = useState(false);

  // Link tab state
  const [shareEnabled, setShareEnabled] = useState(invoice?.share_enabled || false);
  const [shareToken, setShareToken] = useState(invoice?.share_token || '');
  const [savingShare, setSavingShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // PDF tab state
  const [printing, setPrinting] = useState(false);

  const shareUrl = shareToken ? `${window.location.origin}/invoice/${shareToken}` : null;

  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleToggleShare = useCallback(async () => {
    const newEnabled = !shareEnabled;
    let token = shareToken;
    if (newEnabled && !token) {
      token = generateToken();
      setShareToken(token);
    }
    setShareEnabled(newEnabled);
    onShareUpdate?.(token, newEnabled);

    setSavingShare(true);
    try {
      await onSaveShare?.(token, newEnabled);
      showToast(newEnabled ? 'Shareable link enabled' : 'Link disabled');
    } catch {
      showToast('Failed to save share settings');
    } finally {
      setSavingShare(false);
    }
  }, [shareEnabled, shareToken, onShareUpdate, onSaveShare, showToast]);

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendEmail = async () => {
    if (!emailTo) { showToast('Enter a recipient email', 'error'); return; }
    setSendingEmail(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSendingEmail(false);
    showToast('Email sending coming soon — use the shareable link for now');
  };

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 200);
  };

  const tabs = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'link', label: 'Share Link', icon: Link2 },
    { id: 'pdf', label: 'PDF', icon: FileDown },
  ];

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display text-base font-bold text-gray-900">Send Invoice</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {notice && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-gray-800 text-white text-xs font-medium text-center">
            {notice}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 mr-2 transition-colors ${
                tab === id ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
              style={tab === id ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Email tab */}
        {tab === 'email' && (
          <div className="p-6 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                className={`${inputCls} resize-none`}
              />
            </div>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {sendingEmail ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              {sendingEmail ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        )}

        {/* Link tab */}
        {tab === 'link' && (
          <div className="p-6 space-y-4">
            {!invoice?.id && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
                Save the invoice first to enable sharing.
              </p>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                {shareEnabled ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                <div>
                  <p className="text-sm font-medium text-gray-800">{shareEnabled ? 'Link is active' : 'Link is disabled'}</p>
                  <p className="text-xs text-gray-400">{shareEnabled ? 'Anyone with the link can view' : 'Enable to share with client'}</p>
                </div>
              </div>
              <button
                onClick={handleToggleShare}
                disabled={!invoice?.id || savingShare}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${shareEnabled ? '' : 'bg-gray-200'}`}
                style={shareEnabled ? { backgroundColor: 'var(--accent)' } : {}}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${shareEnabled ? 'left-6' : 'left-0.5'}`}
                />
              </button>
            </div>

            {shareEnabled && shareUrl && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Shareable URL</label>
                <div className="flex gap-2">
                  <input
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 bg-gray-50 focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Client can view and download — no login required.</p>
              </div>
            )}
          </div>
        )}

        {/* PDF tab */}
        {tab === 'pdf' && (
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
              <FileDown size={28} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 mb-1">Download as PDF</p>
              <p className="text-xs text-gray-400">Opens your browser's print dialog — choose "Save as PDF" to download.</p>
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {printing ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              {printing ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

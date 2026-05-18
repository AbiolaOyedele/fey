import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, ChevronDown, Plus, Trash2, X, Check,
  GripVertical, ChevronUp, Bookmark, Send, Save, FileText,
  Paperclip, Upload, Image as ImageIcon, Layout, ImagePlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInvoiceData } from '../hooks/useInvoiceData';
import InvoiceSendModal from '../components/InvoiceSendModal';
import { uploadToCloudinary, getFileType, formatFileSize } from '../utils/cloudinary';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { CURRENCY_SYMBOLS } from '../lib/constants';
const FONTS = ['Default', 'Lato', 'Urbanist', 'Spectral', 'Playfair Display', 'Georgia', 'Courier New'];
const INVOICE_LAYOUTS = [
  { id: 'left_aligned', label: 'Left Aligned' },
  { id: 'bold_header',  label: 'Bold Header' },
  { id: 'classic',      label: 'Classic' },
  { id: 'brutalist',    label: 'Brutalist' },
];
const SECTION_TYPES = ['Terms and Conditions','Legal Info','Payment Info','Warranty','Refund Policy','Confidentiality'];
const SECTION_PLACEHOLDERS = {
  'Terms and Conditions': 'By accepting this invoice, the client agrees to the following terms: Payment is due within the specified period. Late payments may incur a fee of 1.5% per month. All work remains the property of the provider until payment is received in full.',
  'Legal Info': 'This invoice constitutes a legally binding agreement between the parties. Any disputes shall be resolved in accordance with the laws of the jurisdiction in which the service provider operates.',
  'Payment Info': 'Bank: First Bank\nAccount Name: Your Business Name\nAccount Number: 0123456789\nSort Code: 00-00-00\n\nAlternatively, payment can be made via bank transfer or mobile payment.',
  'Warranty': 'All services are warranted for a period of 30 days from the date of delivery. Any defects reported within this period will be corrected at no additional charge. This warranty does not cover changes requested after delivery.',
  'Refund Policy': 'Refunds are available within 14 days of invoice date, provided no work has commenced. Once work has started, a pro-rated refund may be issued based on the portion of work completed.',
  'Confidentiality': 'Both parties agree to keep all shared information confidential. The service provider will not disclose any client data to third parties without prior written consent, except as required by law.',
};
const ADDITION_TYPES = [
  { type: 'discount',    label: 'Discount',    isPercent: false, sign: -1 },
  { type: 'tax',         label: 'Tax',          isPercent: true,  sign: 1  },
  { type: 'shipping',    label: 'Shipping',     isPercent: false, sign: 1  },
  { type: 'withholding', label: 'Withholding',  isPercent: false, sign: -1 },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const todayStr = () => new Date().toISOString().split('T')[0];
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};
const fmt = (n, sym) => `${sym}${(Number(n)||0).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const iField = 'w-full bg-transparent border border-transparent rounded px-1 py-0.5 outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white/80 transition-all text-inherit';
const iFieldSm = 'bg-transparent border border-transparent rounded px-1 outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white/80 transition-all text-xs text-inherit';

// ── Inline editable field ─────────────────────────────────────────────────────
function Field({ value, onChange, placeholder, className = '', multiline = false, type = 'text' }) {
  if (multiline) {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${iField} resize-none ${className}`}
      />
    );
  }
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${iField} ${className}`}
    />
  );
}

// ── Layout preview thumbnail ──────────────────────────────────────────────────
function LayoutThumb({ id, accent }) {
  if (id === 'left_aligned') return (
    <div className="p-1.5 h-full flex flex-col gap-1">
      <div className="h-1.5 w-8 bg-gray-700 rounded-sm" />
      <div className="h-0.5 w-5 bg-gray-300 rounded-sm" />
      <div className="flex-1 space-y-0.5 pt-1">
        <div className="h-px w-full bg-gray-200" />
        <div className="h-px w-3/4 bg-gray-100" />
      </div>
    </div>
  );
  if (id === 'bold_header') return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-5 flex items-center justify-center" style={{ backgroundColor: accent + '30' }}>
        <div className="h-1 w-10 rounded-sm" style={{ backgroundColor: accent }} />
      </div>
      <div className="flex-1 p-1 space-y-0.5">
        <div className="h-px w-full bg-gray-200" />
        <div className="h-px w-2/3 bg-gray-100" />
      </div>
    </div>
  );
  if (id === 'classic') return (
    <div className="h-full flex flex-col items-center gap-0.5 p-1.5">
      <div className="w-4 h-4 rounded-full bg-gray-200" />
      <div className="h-1 w-8 bg-gray-700 rounded-sm" />
      <div className="w-full space-y-0.5 pt-1">
        <div className="h-px w-full bg-gray-200" />
        <div className="h-px w-2/3 bg-gray-100 mx-auto" />
      </div>
    </div>
  );
  return (
    <div className="h-full border-2 border-gray-800 rounded overflow-hidden">
      <div className="bg-gray-900 h-4 flex items-center px-1"><div className="h-0.5 w-6 bg-white rounded-sm" /></div>
      <div className="p-1 space-y-0.5">
        <div className="h-px w-full bg-gray-500" />
        <div className="h-px w-2/3 bg-gray-400" />
      </div>
    </div>
  );
}

// ── Main builder ──────────────────────────────────────────────────────────────
export default function InvoiceBuilder({ clients = [], refetch }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, saveSetting } = useSettings();
  const { fetchInvoice, createInvoice, updateInvoice } = useInvoiceData(user?.id);

  const isNew = !id || id === 'new';
  const rs = location.state || {};
  const accent = settings.accent_color || '#ED64A6';
  const currSym = CURRENCY_SYMBOLS[settings.currency] || '$';

  // ── Invoice state (initialised from settings defaults / route state / DB) ──
  const initNum = () => {
    const pfx = settings.invoice_prefix || 'INV-';
    const nxt = String(parseInt(settings.invoice_next || '1', 10)).padStart(4, '0');
    return `${pfx}${nxt}`;
  };
  const initDate = todayStr();
  const initDue  = addDays(initDate, parseInt(settings.payment_terms_days || '14', 10));

  const [loaded,   setLoaded]   = useState(isNew);
  const [savedId,  setSavedId]  = useState(isNew ? null : id);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');

  // Document fields
  const [invoiceNum,  setInvoiceNum]  = useState(initNum());
  const [status,      setStatus]      = useState('draft');
  const [issueDate,   setIssueDate]   = useState(initDate);
  const [dueDate,     setDueDate]     = useState(initDue);
  const [supplyDate,  setSupplyDate]  = useState('');
  const [showSupply,  setShowSupply]  = useState(false);

  const [from, setFrom] = useState({
    name: settings.company_name || '', email: settings.business_email || '',
    phone: settings.business_phone || '', website: settings.business_website || '',
    address: settings.business_address || '', tax_id: settings.tax_id || '',
  });

  const [billTo, setBillTo] = useState({ client_id: '', name: '', email: '', phone: '', address: '', website: '', tax_id: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDD, setShowClientDD] = useState(false);

  const [lineItems, setLineItems] = useState(rs.prefillLineItems || []);
  const [taskIds,   setTaskIds]   = useState(rs.prefillTaskIds   || []);

  // Payment details
  const templates = (() => { try { return JSON.parse(settings.payment_templates || '[]'); } catch { return []; } })();
  const [payMethod,   setPayMethod]   = useState('');
  const [payFields,   setPayFields]   = useState({});
  const [payLink,     setPayLink]     = useState('');

  // Totals
  const [additions, setAdditions] = useState(() => {
    const rate = parseFloat(settings.default_tax_rate) || 0;
    return rate > 0 ? [{ id: uid(), type: 'tax', label: `Tax (${rate}%)`, value: rate, isPercent: true }] : [];
  });
  const [showSig, setShowSig] = useState(false);

  const [notes, setNotes] = useState(settings.default_invoice_notes || '');
  const [customSections, setCustomSections] = useState([]);
  const [activeSecId, setActiveSecId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachUploads, setAttachUploads] = useState([]); // in-progress uploads
  const [showAttach, setShowAttach] = useState(false);
  const attachRef = useRef(null);

  const [betaDismissed, setBetaDismissed] = useState(() => sessionStorage.getItem('invoice_beta_dismissed') === '1');

  // Customize panel
  const [layout,    setLayout]    = useState(settings.invoice_layout   || 'left_aligned');
  const [fontColor, setFontColor] = useState(settings.invoice_font_color || '#1a1a1a');
  const [bgColor,   setBgColor]   = useState(settings.invoice_bg_color  || '#ffffff');
  const [fontFam,   setFontFam]   = useState(settings.font_family || '');
  const [showCover, setShowCover] = useState(false);
  const [logoSize,  setLogoSize]  = useState(60);
  const [invAccent, setInvAccent] = useState(settings.accent_color || '#ED64A6');
  const [bgImage,   setBgImage]   = useState(settings.invoice_bg_image || '');

  // Invoice settings panel
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [invLang,    setInvLang]    = useState(settings.invoice_language || 'English');
  const [invCurrency, setInvCurrency] = useState(settings.currency || 'NGN');
  const [showPayDet, setShowPayDet] = useState(settings.show_payment_on_docs !== 'false');
  const [showSignSetting, setShowSignSetting] = useState(false);

  // Send modal
  const [showSend, setShowSend] = useState(false);
  const [shareToken,   setShareToken]   = useState('');
  const [shareEnabled, setShareEnabled] = useState(false);

  // Save dropdown
  const [saveDropOpen, setSaveDropOpen] = useState(false);

  const invCurrSym = CURRENCY_SYMBOLS[invCurrency] || '$';

  // ── Load existing invoice ──────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) {
      // Pre-fill client from route state
      if (rs.prefillClient) {
        const pc = rs.prefillClient;
        setBillTo({ client_id: pc.id, name: pc.name, email: pc.email || '', phone: pc.phone || '', address: pc.address || '', website: pc.website || '', tax_id: pc.tax_id || '' });
      }
      setLoaded(true);
      return;
    }
    (async () => {
      const { data, error } = await fetchInvoice(id);
      if (error || !data) { navigate('/invoices'); return; }

      setInvoiceNum(data.invoice_number || '');
      setStatus(data.status || 'draft');
      setIssueDate(data.issue_date || initDate);
      setDueDate(data.due_date || initDue);
      if (data.supply_date) { setSupplyDate(data.supply_date); setShowSupply(true); }
      if (data.from_details) setFrom(data.from_details);
      if (data.bill_to) setBillTo(data.bill_to);
      if (data.line_items) setLineItems(data.line_items);
      if (data.task_ids) setTaskIds(Array.isArray(data.task_ids) ? data.task_ids : JSON.parse(data.task_ids || '[]'));
      const pd = data.payment_details || {};
      setPayMethod(pd.method || '');
      setPayFields(pd.fields || {});
      setPayLink(pd.payment_link || '');
      if (data.totals?.additions) setAdditions(data.totals.additions);
      if (data.totals?.showSignature) setShowSig(true);
      setNotes(data.notes || '');
      if (data.custom_sections) setCustomSections(data.custom_sections);
      const inv_s = data.invoice_settings || {};
      if (inv_s.language) setInvLang(inv_s.language);
      if (inv_s.currency) setInvCurrency(inv_s.currency);
      if (inv_s.show_payment !== undefined) setShowPayDet(inv_s.show_payment);
      if (inv_s.signature !== undefined) setShowSignSetting(inv_s.signature);
      if (inv_s.accent) setInvAccent(inv_s.accent);
      if (inv_s.bg_image) setBgImage(inv_s.bg_image);
      setLayout(data.layout || 'left_aligned');
      setFontColor(data.font_color || '#1a1a1a');
      setBgColor(data.bg_color || '#ffffff');
      setFontFam(data.font_family || '');
      setShareToken(data.share_token || '');
      setShareEnabled(data.share_enabled || false);
      if (data.attachments) setAttachments(data.attachments);
      setSavedId(data.id);
      setLoaded(true);
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = lineItems.reduce((s, item) => s + ((Number(item.qty)||1) * (Number(item.price)||0)), 0);
  const total = additions.reduce((s, add) => {
    const amt = add.isPercent ? subtotal * (Number(add.value)||0) / 100 : (Number(add.value)||0);
    return add.type === 'discount' || add.type === 'withholding' ? s - amt : s + amt;
  }, subtotal);

  // ── Client search ─────────────────────────────────────────────────────────
  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const selectClient = (c) => {
    setBillTo({ client_id: c.id, name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', website: c.website || '', tax_id: c.tax_id || '' });
    setClientSearch('');
    setShowClientDD(false);
  };

  // ── Line items ─────────────────────────────────────────────────────────────
  const addLineItem = () => setLineItems((prev) => [...prev, { id: uid(), description: '', qty: 1, price: 0, amount: 0, task_id: null }]);
  const updateLine = (itemId, field, value) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, [field]: value };
      next.amount = (Number(next.qty)||1) * (Number(next.price)||0);
      return next;
    }));
  };
  const removeLine = (itemId) => setLineItems((prev) => prev.filter((i) => i.id !== itemId));

  // ── Additions ─────────────────────────────────────────────────────────────
  const addAddition = (addDef) => {
    if (additions.find((a) => a.type === addDef.type)) return; // already added
    const defaultVal = addDef.type === 'tax' ? (parseFloat(settings.default_tax_rate) || 0) : 0;
    setAdditions((prev) => [...prev, { id: uid(), ...addDef, value: defaultVal }]);
  };
  const updateAddition = (addId, field, value) => {
    setAdditions((prev) => prev.map((a) => a.id === addId ? { ...a, [field]: value } : a));
  };
  const removeAddition = (addId) => setAdditions((prev) => prev.filter((a) => a.id !== addId));

  // ── Custom sections ───────────────────────────────────────────────────────
  const addSection = (title) => {
    const newId = uid();
    setCustomSections((prev) => [...prev, { id: newId, title, body: '' }]);
    setActiveSecId(newId);
  };
  const updateSection = (secId, field, value) => setCustomSections((prev) => prev.map((s) => s.id === secId ? { ...s, [field]: value } : s));
  const moveSection = (secId, dir) => {
    setCustomSections((prev) => {
      const idx = prev.findIndex((s) => s.id === secId);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };
  const removeSection = (secId) => {
    setCustomSections((prev) => {
      const filtered = prev.filter((s) => s.id !== secId);
      if (activeSecId === secId) setActiveSecId(filtered[filtered.length - 1]?.id || null);
      return filtered;
    });
  };

  // ── Attachments ───────────────────────────────────────────────────────────
  const attachAbortsRef = useRef({});

  const handleAttachFiles = useCallback(async (fileList) => {
    for (const file of Array.from(fileList)) {
      const tempId = uid();
      setAttachUploads((p) => [...p, { id: tempId, name: file.name, progress: 0 }]);
      const folder = savedId ? `invoices/${savedId}` : 'invoices/tmp';
      const { promise, abort } = uploadToCloudinary(
        file,
        folder,
        (pct) => setAttachUploads((p) => p.map((u) => u.id === tempId ? { ...u, progress: pct } : u))
      );
      attachAbortsRef.current[tempId] = abort;
      try {
        const { url, publicId, size } = await promise;
        setAttachments((prev) => [
          ...prev,
          {
            id: uid(),
            name: file.name,
            url,
            publicId,
            size: size || file.size,
            fileType: getFileType(file.name),
          },
        ]);
      } catch (err) {
        if (err.message !== 'cancelled') console.error('Attachment upload failed:', err);
      } finally {
        delete attachAbortsRef.current[tempId];
        setAttachUploads((p) => p.filter((u) => u.id !== tempId));
      }
    }
  }, [savedId]);

  const cancelAttachUpload = useCallback((tempId) => {
    attachAbortsRef.current[tempId]?.();
  }, []);

  const deleteAttachment = useCallback(async (attId, publicId) => {
    if (publicId) {
      try {
        await supabase.functions.invoke('delete-cloudinary-file', { body: { public_id: publicId } });
      } catch (e) {
        console.warn('Cloudinary delete failed:', e);
      }
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const buildPayload = useCallback((saveStatus) => ({
    invoice_number: invoiceNum,
    status: saveStatus || status,
    issue_date: issueDate,
    due_date: dueDate,
    supply_date: showSupply ? supplyDate : null,
    client_id: billTo.client_id || null,
    from_details: from,
    bill_to: billTo,
    line_items: lineItems,
    task_ids: taskIds,
    payment_details: { method: payMethod, fields: payFields, payment_link: payLink },
    totals: { additions, showSignature: showSig, subtotal, total },
    notes,
    currency: invCurrency,
    layout,
    font_color: fontColor,
    bg_color: bgColor,
    font_family: fontFam,
    custom_sections: customSections,
    invoice_settings: { language: invLang, currency: invCurrency, show_payment: showPayDet, signature: showSignSetting, accent: invAccent, bg_image: bgImage },
    share_token: shareToken || null,
    share_enabled: shareEnabled,
    attachments,
  }), [invoiceNum, status, issueDate, dueDate, showSupply, supplyDate, billTo, from, lineItems, taskIds, payMethod, payFields, payLink, additions, showSig, subtotal, total, notes, invCurrency, layout, fontColor, bgColor, bgImage, fontFam, customSections, invLang, showPayDet, showSignSetting, shareToken, shareEnabled, attachments]);

  const doSave = async (saveStatus) => {
    setSaving(true);
    setSaveMsg('');
    const payload = buildPayload(saveStatus);
    let result;
    if (savedId) {
      result = await updateInvoice(savedId, payload);
    } else {
      result = await createInvoice(payload);
      if (result.data) {
        setSavedId(result.data.id);
        // Increment invoice number counter in settings
        const nextNum = String(parseInt(settings.invoice_next || '1', 10) + 1).padStart(3, '0');
        saveSetting('invoice_next', nextNum);
        navigate(`/invoices/${result.data.id}`, { replace: true });
      }
    }
    setSaving(false);
    if (result.error) { setSaveMsg(`Error: ${result.error}`); }
    else { setSaveMsg('Saved'); setTimeout(() => setSaveMsg(''), 2500); }
    return result;
  };

  // ── Payment template selection ─────────────────────────────────────────────
  const selectedTemplate = templates.find((t) => t.name === payMethod);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  const documentStyle = {
    color: fontColor,
    backgroundColor: bgColor,
    fontFamily: fontFam || 'var(--body-font)',
    ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* ── Top nav ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 no-print">
        <button onClick={() => navigate('/invoices')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 mr-auto">
          <FileText size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Invoice</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-1 ${
            status === 'paid' ? 'bg-green-100 text-green-700' :
            status === 'sent' ? 'bg-blue-100 text-blue-700' :
            status === 'overdue' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>

        {/* Client/project picker */}
        <div className="hidden md:block relative">
          <button
            onClick={() => setShowClientDD((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {billTo.name || 'Select project'}
            <ChevronDown size={13} />
          </button>
          {showClientDD && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowClientDD(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                <div className="p-2">
                  <input type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients…" className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-gray-400" autoFocus />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg flex-shrink-0" style={{ backgroundColor: c.color || accent }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {saveMsg && <span className="text-xs text-gray-500">{saveMsg}</span>}

        {/* Save dropdown */}
        <div className="relative flex">
          <button
            onClick={() => doSave(status)}
            disabled={saving}
            className="px-3 py-2 rounded-l-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save size={14} />{saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setSaveDropOpen((o) => !o)}
            className="px-2 py-2 rounded-r-xl text-sm font-medium border border-l-0 border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronDown size={14} />
          </button>
          {saveDropOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSaveDropOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                <button onClick={() => { doSave('draft'); setSaveDropOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Save as Draft</button>
                <button onClick={() => { doSave(status); setSaveDropOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Save</button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={async () => {
            if (!savedId) { const r = await doSave('draft'); if (r.error) return; }
            setShowSend(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <Send size={14} />Create/Send
        </button>

        <button onClick={() => setShowSettingsPanel((o) => !o)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Invoice settings">
          <Settings size={16} />
        </button>
      </div>

      {/* ── Invoice settings panel (overlay) ── */}
      {/* ── Beta warning banner ── */}
      {!betaDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 no-print">
          <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">BETA</span>
          <p className="text-xs text-amber-700 flex-1">Invoicing is still in testing — some features may not work as expected. Proceed with caution.</p>
          <button
            onClick={() => { setBetaDismissed(true); sessionStorage.setItem('invoice_beta_dismissed', '1'); }}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 underline flex-shrink-0 transition-colors"
          >Got it</button>
        </div>
      )}

      {showSettingsPanel && (
        <>
          <div className="fixed inset-0 z-30 no-print" onClick={() => setShowSettingsPanel(false)} />
          <div className="fixed right-4 top-16 w-72 bg-white rounded-2xl border border-gray-200 shadow-2xl z-40 p-5 space-y-4 no-print">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Invoice Settings</h3>
              <button onClick={() => setShowSettingsPanel(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={14} /></button>
            </div>
            {[
              { label: 'Language', value: invLang, onChange: setInvLang, options: ['English','French','Spanish','German','Portuguese','Italian','Arabic'] },
              { label: 'Currency', value: invCurrency, onChange: setInvCurrency, options: Object.keys(CURRENCY_SYMBOLS) },
            ].map(({ label, value, onChange, options }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1.5">{label}</p>
                <div className="relative">
                  <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 appearance-none">
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            ))}
            {[
              { label: 'Show payment details', checked: showPayDet, onChange: setShowPayDet },
              { label: 'Signature', checked: showSignSetting, onChange: setShowSignSetting },
              { label: 'Recurring invoice', checked: false, onChange: () => {}, placeholder: true },
              { label: 'Password protection', checked: false, onChange: () => {}, placeholder: true },
            ].map(({ label, checked, onChange, placeholder }) => (
              <div key={label} className={`flex items-center justify-between ${placeholder ? 'opacity-40' : ''}`}>
                <span className="text-sm text-gray-700">{label}{placeholder && <span className="ml-1 text-[10px] text-gray-400">(soon)</span>}</span>
                <button disabled={placeholder} onClick={() => onChange(!checked)}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={checked && !placeholder ? { backgroundColor: accent } : { backgroundColor: '#e5e7eb' }}
                >
                  <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform" style={{ left: checked && !placeholder ? '17px' : '2px' }} />
                </button>
              </div>
            ))}

          </div>
        </>
      )}

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Invoice document ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
          <div
            id="invoice-document"
            className="w-full max-w-2xl rounded-2xl shadow-lg p-8 md:p-12 invoice-print-area"
            style={documentStyle}
          >
            {/* Header */}
            {(() => {
              const logo = settings.logo;
              const coverImg = settings.cover_image;

              if (layout === 'bold_header') return (
                <div className="rounded-xl overflow-hidden mb-8" style={{ backgroundColor: invAccent }}>
                  {showCover && coverImg && <img src={coverImg} alt="Cover" className="w-full h-24 object-cover opacity-60" />}
                  <div className="px-6 py-5 flex items-center justify-between">
                    {logo && <img src={logo} alt="Logo" className="object-contain rounded-lg" style={{ height: logoSize, maxHeight: 80 }} />}
                    <div className="text-right text-white">
                      <p className="text-2xl font-bold tracking-widest">INVOICE</p>
                      <p className="text-sm opacity-80 mt-0.5">
                        <input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} className="bg-transparent border-none outline-none text-right font-mono text-sm text-white placeholder-white/60 w-32" placeholder="INV-0001" />
                      </p>
                    </div>
                  </div>
                </div>
              );

              if (layout === 'classic') return (
                <div className="text-center mb-8">
                  {logo && <img src={logo} alt="Logo" className="object-contain rounded-xl mx-auto mb-3" style={{ height: logoSize, maxHeight: 80 }} />}
                  {!logo && <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: invAccent }}>{(from.name || 'W').slice(0, 1)}</div>}
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Invoice</p>
                  <input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} className="text-center font-bold text-xl w-full bg-transparent border-none outline-none hover:bg-black/5 rounded" placeholder="INV-0001" />
                </div>
              );

              if (layout === 'brutalist') return (
                <div className="border-2 mb-8 rounded-lg overflow-hidden" style={{ borderColor: fontColor }}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: fontColor }}>
                    {logo && <img src={logo} alt="Logo" className="object-contain rounded-lg" style={{ height: logoSize * 0.6, maxHeight: 50 }} />}
                    <p className="text-2xl font-black tracking-widest" style={{ color: bgColor }}>INVOICE</p>
                  </div>
                  <div className="px-5 py-3">
                    <input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} className="font-mono font-bold text-lg bg-transparent border-none outline-none hover:bg-black/5 rounded w-full" placeholder="INV-0001" />
                  </div>
                </div>
              );

              // default: left_aligned
              return (
                <div className="flex items-start justify-between mb-8">
                  <div>
                    {logo && <img src={logo} alt="Logo" className="object-contain rounded-xl mb-2" style={{ height: logoSize, maxHeight: 80 }} />}
                    {!logo && <div className="w-12 h-12 rounded-xl mb-2 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: invAccent }}>{(from.name || 'W').slice(0, 1)}</div>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Invoice</p>
                    <input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} className="font-bold text-xl text-right w-44 bg-transparent border-none outline-none hover:bg-black/5 rounded" placeholder="INV-0001" />
                  </div>
                </div>
              );
            })()}

            {/* FROM / BILL TO */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">From</p>
                {['name','email','phone','website','address','tax_id'].map((field) => (
                  <input key={field} value={from[field] || ''} onChange={(e) => setFrom((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={field.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    className={`${iField} text-sm mb-0.5`} />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Bill To</p>
                {/* Client search */}
                <div className="relative mb-0.5">
                  <input
                    value={showClientDD ? clientSearch : billTo.name}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDD(true); setBillTo((b) => ({ ...b, name: e.target.value })); }}
                    onFocus={() => setShowClientDD(true)}
                    placeholder="Client name"
                    className={`${iField} text-sm font-semibold`}
                  />
                  {showClientDD && filteredClients.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowClientDD(false)} />
                      <div className="absolute left-0 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden max-h-40 overflow-y-auto">
                        {filteredClients.map((c) => (
                          <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: c.color || accent }} />
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {['email','phone','address','website','tax_id'].map((field) => (
                  <input key={field} value={billTo[field] || ''} onChange={(e) => setBillTo((b) => ({ ...b, [field]: e.target.value }))}
                    placeholder={field.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    className={`${iField} text-sm mb-0.5`} />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mr-2">Issue Date</span>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={iFieldSm} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mr-2">Due Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={iFieldSm} />
              </div>
              {showSupply ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mr-2">Supply Date</span>
                  <input type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} className={iFieldSm} />
                  <button onClick={() => { setShowSupply(false); setSupplyDate(''); }} className="p-0.5 rounded hover:bg-black/10 opacity-40 hover:opacity-70 transition-opacity"><X size={10} /></button>
                </div>
              ) : (
                <button onClick={() => setShowSupply(true)} className="text-xs opacity-40 hover:opacity-70 transition-opacity underline">+ Supply Date</button>
              )}
            </div>

            {/* Line items */}
            <div className="mb-6">
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-current opacity-30 text-[10px] font-bold uppercase tracking-widest">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              <div className="space-y-1 mt-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center group">
                    <div className="col-span-6">
                      <input value={item.description} onChange={(e) => updateLine(item.id, 'description', e.target.value)} placeholder="Item description" className={`${iField} text-sm`} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.qty} onChange={(e) => updateLine(item.id, 'qty', e.target.value)} className={`${iField} text-sm text-center`} min="0" step="0.01" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.price} onChange={(e) => updateLine(item.id, 'price', e.target.value)} className={`${iField} text-sm text-right`} min="0" step="0.01" />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span className="text-sm font-medium">{fmt((Number(item.qty)||1) * (Number(item.price)||0), invCurrSym)}</span>
                      <button onClick={() => removeLine(item.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-400 transition-all">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={addLineItem} className="flex items-center gap-1.5 text-xs font-medium opacity-50 hover:opacity-100 transition-opacity">
                  <Plus size={12} />Add Line Item
                </button>
                <button className="flex items-center gap-1.5 text-xs font-medium opacity-30 cursor-not-allowed" disabled title="From Catalog — coming soon">
                  <FileText size={12} />From Catalog
                </button>
              </div>
            </div>

            {/* Payment details */}
            {showPayDet && (
              <div className="mb-6 border-t border-current border-opacity-10 pt-5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">Payment Details</p>
                <div className="relative max-w-xs mb-3">
                  <select value={payMethod} onChange={(e) => {
                    const name = e.target.value;
                    setPayMethod(name);
                    const tpl = templates.find((t) => t.name === name);
                    if (tpl) {
                      const pre = {};
                      (tpl.fields || []).forEach((f) => {
                        const label = typeof f === 'string' ? f : f.label;
                        const val = typeof f === 'string' ? '' : (f.value || '');
                        pre[label] = val;
                      });
                      setPayFields(pre);
                    } else {
                      setPayFields({});
                    }
                  }}
                    className="w-full bg-transparent border border-current border-opacity-20 rounded-lg px-3 py-1.5 text-sm outline-none appearance-none"
                  >
                    <option value="">Select payment method</option>
                    {templates.map((t) => <option key={t.name} value={t.name}>{t.method ? `${t.name} — ${t.method}` : t.name}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                </div>
                {selectedTemplate?.fields?.map((f) => {
                  const label = typeof f === 'string' ? f : f.label;
                  return (
                    <div key={label} className="flex gap-3 text-sm mb-1">
                      <span className="opacity-50 w-36 flex-shrink-0">{label}:</span>
                      <input value={payFields[label] || ''} onChange={(e) => setPayFields((prev) => ({ ...prev, [label]: e.target.value }))}
                        placeholder="—" className={`${iField} flex-1`} />
                    </div>
                  );
                })}
                <div className="flex gap-3 text-sm mt-2">
                  <span className="opacity-50 w-36 flex-shrink-0">Payment Link:</span>
                  <input value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://..." className={`${iField} flex-1`} />
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="mb-6 border-t border-current border-opacity-10 pt-5">
              <div className="flex justify-end">
                <div className="w-56 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Subtotal</span>
                    <span>{fmt(subtotal, invCurrSym)}</span>
                  </div>
                  {additions.map((add) => {
                    const amt = add.isPercent ? subtotal * (Number(add.value)||0) / 100 : (Number(add.value)||0);
                    return (
                      <div key={add.id} className="flex items-center gap-2 text-sm group">
                        <input value={add.label} onChange={(e) => updateAddition(add.id, 'label', e.target.value)} className={`${iField} flex-1 text-opacity-60`} style={{ opacity: 0.7 }} />
                        <input type="number" value={add.value} onChange={(e) => updateAddition(add.id, 'value', e.target.value)} className={`${iField} w-16 text-right`} min="0" step="0.01" />
                        {add.isPercent && <span className="opacity-40 text-xs">%</span>}
                        <span className="w-20 text-right">{add.type === 'discount' || add.type === 'withholding' ? '-' : '+'}{fmt(Math.abs(amt), invCurrSym)}</span>
                        <button onClick={() => removeAddition(add.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-400 transition-all"><X size={10} /></button>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {ADDITION_TYPES.filter((a) => !additions.find((x) => x.type === a.type)).map((a) => (
                      <button key={a.type} onClick={() => addAddition(a)} className="text-xs opacity-40 hover:opacity-70 transition-opacity underline capitalize">{`+ ${a.label}`}</button>
                    ))}
                    {!showSig && <button onClick={() => setShowSig(true)} className="text-xs opacity-40 hover:opacity-70 transition-opacity underline">+ Signature</button>}
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-current border-opacity-20">
                    <span>Total</span>
                    <span>{fmt(total, invCurrSym)}</span>
                  </div>
                  {showSig && (
                    <div className="pt-4 border-t border-current border-opacity-20">
                      <div className="h-12 border-b border-current border-opacity-20" />
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs opacity-40">Signature</p>
                        <button onClick={() => setShowSig(false)} className="p-0.5 rounded hover:bg-black/10 opacity-30"><X size={10} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6 border-t border-current border-opacity-10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Notes</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Thank you for your business!"
                className={`${iField} text-sm resize-none`} />
            </div>

            {/* Sections tab strip */}
            {customSections.length > 0 && (
              <div className="mb-4 border-t border-current border-opacity-10 pt-4">
                {/* Tab strip */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  {customSections.map((sec, idx) => (
                    <div key={sec.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${activeSecId === sec.id ? 'border-current border-opacity-40 bg-black/5 font-medium' : 'border-current border-opacity-10 opacity-50 hover:opacity-70'}`}
                      onClick={() => setActiveSecId(sec.id)}>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(sec.id, 'up'); }} disabled={idx === 0} className="opacity-50 hover:opacity-100 disabled:opacity-20 transition-opacity">
                        <ChevronUp size={10} />
                      </button>
                      <span className="max-w-[80px] truncate">{sec.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(sec.id, 'down'); }} disabled={idx === customSections.length - 1} className="opacity-50 hover:opacity-100 disabled:opacity-20 transition-opacity">
                        <ChevronDown size={10} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeSection(sec.id); }} className="text-red-400 hover:text-red-600 transition-colors ml-0.5">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Active section content */}
                {customSections.filter((s) => s.id === activeSecId).map((sec) => (
                  <div key={sec.id}>
                    <input value={sec.title} onChange={(e) => updateSection(sec.id, 'title', e.target.value)}
                      className={`${iField} text-sm font-bold uppercase tracking-wide opacity-60 mb-2`} />
                    <textarea value={sec.body} onChange={(e) => updateSection(sec.id, 'body', e.target.value)} rows={5}
                      placeholder={SECTION_PLACEHOLDERS[sec.title] || 'Add text here…'} className={`${iField} text-sm resize-none`} />
                  </div>
                ))}
              </div>
            )}

            {/* Add section chips */}
            <div className="mb-4 flex flex-wrap gap-2">
              {SECTION_TYPES.filter((s) => !customSections.find((cs) => cs.title === s)).map((s) => (
                <button key={s} onClick={() => addSection(s)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-current border-opacity-20 opacity-50 hover:opacity-80 transition-opacity"
                >
                  <Plus size={10} />{s}
                </button>
              ))}
            </div>

            {/* Attachments */}
            <div className="border-t border-current border-opacity-10 pt-5">
              <button onClick={() => setShowAttach((o) => !o)} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-80 transition-opacity mb-3">
                <Paperclip size={13} />Attachments {(attachments.length + attachUploads.length) > 0 && `(${attachments.length + attachUploads.length})`}
                {showAttach ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showAttach && (
                <div>
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleAttachFiles(e.dataTransfer.files); }}
                    onClick={() => attachRef.current?.click()}
                    className="border-2 border-dashed border-current border-opacity-20 rounded-xl p-6 text-center cursor-pointer hover:border-opacity-40 transition-all mb-3"
                  >
                    <Upload size={18} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs opacity-40">Drag & drop files or click to upload</p>
                    <input ref={attachRef} type="file" multiple className="hidden" onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ''; }} />
                  </div>

                  {/* Active uploads with progress */}
                  {attachUploads.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 py-2 text-sm">
                      <Loader2 size={13} className="animate-spin opacity-40 flex-shrink-0" />
                      <span className="flex-1 truncate opacity-60">{u.name}</span>
                      <div className="w-16 h-1 bg-current bg-opacity-10 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full transition-all" style={{ width: `${u.progress}%`, backgroundColor: invAccent }} />
                      </div>
                      <span className="text-xs opacity-30 flex-shrink-0">{u.progress}%</span>
                      <button
                        onClick={() => cancelAttachUpload(u.id)}
                        className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all flex-shrink-0"
                        title="Cancel upload"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Uploaded files */}
                  {attachments.map((att) => (
                    <div key={att.id} className="group/att flex items-center gap-3 py-2 text-sm">
                      <Paperclip size={13} className="opacity-40 flex-shrink-0" />
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate opacity-70 hover:opacity-100 hover:underline">
                          {att.name}
                        </a>
                      ) : (
                        <span className="flex-1 truncate opacity-70">{att.name}</span>
                      )}
                      <span className="text-xs opacity-30 flex-shrink-0">{formatFileSize(att.size)}</span>
                      <button
                        onClick={() => deleteAttachment(att.id, att.publicId)}
                        className="opacity-0 group-hover/att:opacity-100 p-0.5 rounded hover:text-red-400 transition-all text-current"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invoice footer */}
            <div className="mt-8 pt-4 border-t border-current border-opacity-10 flex items-center justify-between">
              <p className="text-[10px] opacity-25">Created with WorkBoard</p>
              <p className="text-[10px] opacity-40 font-medium">{invoiceNum}</p>
            </div>
          </div>
        </div>

        {/* ── Right: Customize panel ── */}
        <div className="hidden lg:flex flex-col w-64 bg-white border-l border-gray-200 overflow-y-auto no-print flex-shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Customize</h3>
          </div>

          <div className="p-4 space-y-5 flex-1">
            {/* Layout */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Layout</p>
              <div className="grid grid-cols-2 gap-2">
                {INVOICE_LAYOUTS.map(({ id: lid, label }) => (
                  <button key={lid} onClick={() => setLayout(lid)}
                    className={`flex flex-col items-center gap-1 p-1`}
                  >
                    <div className={`w-full h-14 rounded-lg border-2 overflow-hidden transition-all ${layout === lid ? '' : 'border-gray-200 hover:border-gray-300'}`}
                      style={layout === lid ? { borderColor: accent } : {}}
                    >
                      <LayoutThumb id={lid} accent={accent} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Font</p>
              <div className="relative">
                <select value={fontFam} onChange={(e) => setFontFam(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 appearance-none">
                  {FONTS.map((f) => <option key={f} value={f === 'Default' ? '' : f}>{f}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-3">
              {[
                { label: 'Font color', value: fontColor, onChange: setFontColor },
                { label: 'Background', value: bgColor,   onChange: setBgColor   },
              ].map(({ label, value, onChange }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">{label}</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0 relative overflow-hidden">
                      <div className="absolute inset-0" style={{ backgroundColor: value }} />
                      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                    <span className="text-xs font-mono text-gray-500">{value}</span>
                  </label>
                </div>
              ))}
              {(layout === 'bold_header' || layout === 'brutalist') && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">Header color</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0 relative overflow-hidden">
                      <div className="absolute inset-0" style={{ backgroundColor: invAccent }} />
                      <input type="color" value={invAccent} onChange={(e) => setInvAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                    <span className="text-xs font-mono text-gray-500">{invAccent}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Header Cover */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700">Header Cover</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{settings.cover_image ? 'From Branding' : 'Upload in Branding tab'}</p>
              </div>
              <button onClick={() => setShowCover((o) => !o)}
                className="relative w-9 h-5 rounded-full transition-colors"
                style={showCover ? { backgroundColor: accent } : { backgroundColor: '#e5e7eb' }}
                disabled={!settings.cover_image}
              >
                <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform" style={{ left: showCover ? '17px' : '2px' }} />
              </button>
            </div>

            {/* Logo size */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs text-gray-400 font-medium">Logo Size</p>
                <span className="text-xs text-gray-400">{logoSize}px</span>
              </div>
              <input type="range" min="24" max="100" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))}
                className="w-full accent-[var(--accent)]" />
            </div>

            {/* Background image */}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1.5">Background Image</p>
              {bgImage ? (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                    <img src={bgImage} alt="bg" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => setBgImage('')} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-dashed border-gray-300 hover:border-gray-400 transition-colors">
                  <ImagePlus size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setBgImage(ev.target.result);
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSend && (
        <InvoiceSendModal
          invoice={{ id: savedId, invoice_number: invoiceNum, bill_to: billTo, from_details: from, share_token: shareToken, share_enabled: shareEnabled }}
          onShareUpdate={(token, enabled) => { setShareToken(token); setShareEnabled(enabled); }}
          onSaveShare={async (token, enabled) => {
            if (savedId) await updateInvoice(savedId, { share_token: token, share_enabled: enabled });
          }}
          userId={user?.id}
          onClose={() => setShowSend(false)}
        />
      )}
    </div>
  );
}

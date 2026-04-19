import { useState, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Upload, RefreshCw, Trash2, RotateCcw, X, Palette, User, Type,
  Monitor, Sparkles, History, Database, LogOut, ChevronDown, ChevronRight,
  CreditCard, Edit3, Image,
} from 'lucide-react';
import WhatsNewPopup from '../components/WhatsNewPopup';
import ChangelogPopup from '../components/ChangelogPopup';
import { supabase } from '../lib/supabase';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

const THEME_COLORS = [
  '#ED64A6', '#F56565', '#ED8936', '#38B2AC',
  '#9F7AEA', '#667EEA', '#48BB78', '#4299E1',
];

const normalizeHex = (val) => {
  const trimmed = val.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const isValidHex = (val) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val));

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function escapeCsvField(val) {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCSV(fields) {
  return fields.map(escapeCsvField).join(',');
}

// ── Row component for the settings list ──────────────────────────────────────
function SettingRow({ icon: Icon, title, description, action, border = true }) {
  return (
    <div className={`flex items-center gap-4 py-4 ${border ? 'border-b border-gray-100' : ''}`}>
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ── Section group ─────────────────────────────────────────────────────────────
function SectionGroup({ title, children }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm px-5">
        {children}
      </div>
    </div>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

const NAV = [
  { group: null, items: ['Workspace'] },
  { group: null, items: ['Branding'] },
  { group: null, items: ['Others'] },
];

export default function Settings({ clients, refetch }) {
  const {
    settings,
    saveSetting,
    refreshExchangeRate,
    trash,
    restoreFromTrash,
    deleteForever,
    showToast,
    dismissToast,
  } = useSettings();

  const { user, signOut } = useAuth();

  const cl = settings.clients_label || 'Clients';
  const APP_MODES = [
    { value: 'dual',    label: 'Dual',           description: `${cl} + Tasks` },
    { value: 'clients', label: `${cl} Only`,     description: 'Tasks hidden' },
    { value: 'tasks',   label: 'Tasks Only',     description: `${cl} hidden` },
  ];

  const [activeSection, setActiveSection] = useState('Workspace');
  const [clientsLabelInput, setClientsLabelInput] = useState(settings.clients_label || 'Clients');
  const [refreshing, setRefreshing] = useState(false);
  const [accentHexInput, setAccentHexInput] = useState('');
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const importFileRef = useRef(null);
  const bodyFontFileRef = useRef(null);
  const headingFontFileRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showToast('Logo must be under 500KB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => saveSetting('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => saveSetting('logo', '');

  const handleRefreshRate = async () => {
    setRefreshing(true);
    await refreshExchangeRate();
    setRefreshing(false);
    showToast('Exchange rate updated');
  };

  const handleAccentHexChange = (val) => {
    setAccentHexInput(val);
    if (isValidHex(val)) saveSetting('accent_color', normalizeHex(val));
  };

  const handleBodyFontUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Font file must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const fontName = file.name.replace(/\.[^.]+$/, '');
      saveSetting('custom_font', reader.result);
      saveSetting('custom_font_name', fontName);
      saveSetting('font_family', 'custom');
    };
    reader.readAsDataURL(file);
  };

  const handleHeadingFontUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Font file must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const fontName = file.name.replace(/\.[^.]+$/, '');
      saveSetting('custom_heading_font', reader.result);
      saveSetting('custom_heading_font_name', fontName);
      saveSetting('heading_font', 'custom');
    };
    reader.readAsDataURL(file);
  };

  const handleRestore = async (item) => {
    const result = await restoreFromTrash(item, clients);
    if (result?.error) { showToast(`Restore failed: ${result.error}`); return; }
    let toastId = null;
    const timer = setTimeout(() => { toastId = showToast('Restored successfully, refreshing...'); }, 1000);
    if (refetch) await refetch();
    clearTimeout(timer);
    if (toastId !== null) dismissToast(toastId);
    showToast(result?.autoRestoredClient ? 'Client and task restored' : `"${item.item_name}" restored`);
  };

  const handleDeleteForever = async (item) => {
    await deleteForever(item.id);
    showToast(`"${item.item_name}" permanently deleted`);
  };

  const handleExportData = () => {
    const headers = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at';
    const rows = [];
    (clients || []).forEach((client) => {
      if (!client.tasks || client.tasks.length === 0) {
        rows.push(rowToCSV([client.name, client.color || '', client.retainer || 0, '', '', '', '', '', '', '']));
      } else {
        client.tasks.forEach((task) => {
          rows.push(rowToCSV([client.name, client.color || '', client.retainer || 0, task.title || '', task.done ? 'true' : 'false', task.paid ? 'true' : 'false', task.amount || 0, task.currency || 'NGN', task.deadline || '', task.createdAt || '']));
        });
      }
    });
    downloadCSV(`workboard-export-${todayStr()}.csv`, [headers, ...rows].join('\n'));
  };

  const handleExportPayments = () => {
    const headers = 'client_name,task_title,amount,currency,type,month,paid_at';
    const rows = [];
    (clients || []).forEach((client) => {
      (client.tasks || []).forEach((task) => {
        if (task.paid) rows.push(rowToCSV([client.name, task.title || '', task.amount || 0, task.currency || 'NGN', 'task', '', '']));
      });
      if (client.retainerPaid && typeof client.retainerPaid === 'object') {
        Object.entries(client.retainerPaid).forEach(([month, paid]) => {
          if (paid) rows.push(rowToCSV([client.name, '', client.retainer || 0, 'NGN', 'retainer', month, '']));
        });
      }
    });
    downloadCSV(`workboard-payments-${todayStr()}.csv`, [headers, ...rows].join('\n'));
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (IS_DEMO) { showToast('Import is disabled in demo mode'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) throw new Error('CSV appears to be empty or has no data rows');
      const expectedHeaders = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at';
      if (lines[0].trim() !== expectedHeaders) throw new Error('CSV headers do not match the expected WorkBoard export format');
      const dataRows = lines.slice(1).map((line) => {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
          else if (ch === ',' && !inQuotes) { fields.push(current); current = ''; }
          else { current += ch; }
        }
        fields.push(current);
        return { client_name: fields[0] || '', client_color: fields[1] || '#ED64A6', retainer_amount: fields[2] || '0', task_title: fields[3] || '', task_done: fields[4] || 'false', task_paid: fields[5] || 'false', task_amount: fields[6] || '0', task_currency: fields[7] || 'NGN', task_deadline: fields[8] || '', task_created_at: fields[9] || '' };
      });
      const grouped = {};
      dataRows.forEach((row) => { if (!row.client_name) return; if (!grouped[row.client_name]) grouped[row.client_name] = []; grouped[row.client_name].push(row); });
      let clientsImported = 0, tasksImported = 0;
      for (const [clientName, rows] of Object.entries(grouped)) {
        const existing = (clients || []).find((c) => c.name.toLowerCase() === clientName.toLowerCase());
        let clientId;
        if (existing) { clientId = existing.id; }
        else {
          const firstRow = rows[0];
          const { data: newClient, error: cErr } = await supabase.from('clients').insert({ name: clientName, color: firstRow.client_color || '#ED64A6', retainer: parseFloat(firstRow.retainer_amount) || 0, user_id: user?.id }).select().single();
          if (cErr) throw cErr;
          clientId = newClient.id;
          clientsImported++;
        }
        for (const row of rows) {
          if (!row.task_title) continue;
          const { error: tErr } = await supabase.from('tasks').insert({ client_id: clientId, title: row.task_title, done: row.task_done === 'true', paid: row.task_paid === 'true', amount: parseFloat(row.task_amount) || 0, currency: row.task_currency || 'NGN', deadline: row.task_deadline || null, user_id: user?.id });
          if (tErr) throw tErr;
          tasksImported++;
        }
      }
      showToast(`Import complete. ${clientsImported} client${clientsImported !== 1 ? 's' : ''} and ${tasksImported} task${tasksImported !== 1 ? 's' : ''} imported.`);
      if (refetch) await refetch();
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const currentMode = settings.app_mode || 'dual';
  const selectClass = 'w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all appearance-none cursor-pointer';

  // ── Section content renderer ─────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {

      // ── WORKSPACE: General + App Mode + Dashboard + Currency ──────────────
      case 'Workspace':
        return (
          <>
            {/* General */}
            <SectionGroup title="General">
              <SettingRow
                icon={Edit3}
                title="Your Name"
                description="How you appear across the app"
                action={
                  <input type="text" value={settings.username} onChange={(e) => saveSetting('username', e.target.value)} placeholder="e.g. Alex Johnson"
                    className="w-40 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all text-right" />
                }
              />
              <SettingRow
                icon={Monitor}
                title="Company Name"
                description="Shown on your profile and shared pages"
                action={
                  <input type="text" value={settings.company_name} onChange={(e) => saveSetting('company_name', e.target.value)} placeholder="e.g. Studio Co."
                    className="w-40 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all text-right" />
                }
              />
              <SettingRow
                icon={Image}
                title="Workspace Logo"
                description="PNG or JPG · max 500 KB"
                action={
                  <div className="flex items-center gap-2">
                    {settings.logo && (
                      <div className="relative group">
                        <img src={settings.logo} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-white border border-gray-200" />
                        <button onClick={handleRemoveLogo} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                      <Upload size={12} />Upload
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </div>
                }
              />
              <SettingRow
                icon={Edit3}
                title={`${cl} Section Label`}
                description={`Renames "${cl}" throughout the app`}
                border={false}
                action={
                  <input type="text" value={clientsLabelInput} onChange={(e) => setClientsLabelInput(e.target.value)} onBlur={(e) => saveSetting('clients_label', e.target.value.trim() || 'Clients')} placeholder="Clients"
                    className="w-36 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all text-right" />
                }
              />
            </SectionGroup>

            {/* App Mode */}
            <SectionGroup title="App Mode">
              <div className="py-4">
                <div className="grid grid-cols-3 gap-2">
                  {APP_MODES.map(({ value, label, description }) => (
                    <button key={value} onClick={() => saveSetting('app_mode', value)}
                      className={`rounded-xl p-3 text-left border-2 transition-all ${currentMode === value ? 'border-transparent' : 'border-gray-100 hover:border-gray-200'}`}
                      style={currentMode === value ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)' } : {}}
                    >
                      <p className="text-sm font-semibold mb-0.5" style={currentMode === value ? { color: 'var(--accent)' } : { color: '#374151' }}>{label}</p>
                      <p className="text-xs text-gray-400 leading-snug">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </SectionGroup>

            {/* Dashboard text */}
            <SectionGroup title="Dashboard">
              <div className="py-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Heading</p>
                  <textarea value={settings.dashboard_heading} onChange={(e) => saveSetting('dashboard_heading', e.target.value)} rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all resize-none"
                    placeholder={`Track your\nwork & earnings`} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Subtitle <span className="italic">(optional)</span></p>
                  <input type="text" value={settings.dashboard_subtitle} onChange={(e) => saveSetting('dashboard_subtitle', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all"
                    placeholder="A short tagline or welcome message" />
                </div>
              </div>
            </SectionGroup>

            {/* Currency */}
            <SectionGroup title="Currency">
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {[{ code: 'NGN', label: '₦ NGN' }, { code: 'USD', label: '$ USD' }, { code: 'GBP', label: '£ GBP' }, { code: 'EUR', label: '€ EUR' }].map(({ code, label }) => (
                    <button key={code} onClick={() => saveSetting('currency', code)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${settings.currency === code ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300 bg-gray-50'}`}
                      style={settings.currency === code ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                    >{label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={handleRefreshRate} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-50">
                    <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />Refresh rates
                  </button>
                  {settings.exchange_rate_updated_at && <span className="text-xs text-gray-400">Updated {settings.exchange_rate_updated_at}</span>}
                  {(() => {
                    let rates = null;
                    try { rates = JSON.parse(settings.exchange_rates); } catch { /* ignore */ }
                    if (!rates) return null;
                    return <span className="text-xs text-gray-400 font-mono">1 USD = ₦{(rates.NGN || 0).toLocaleString()} · £{(rates.GBP || 0).toFixed(2)} · €{(rates.EUR || 0).toFixed(2)}</span>;
                  })()}
                </div>
              </div>
            </SectionGroup>
          </>
        );

      // ── BRANDING: Theme & Colors + Typography ─────────────────────────────
      case 'Branding':
        return (
          <>
            <SectionGroup title="Accent Color">
              <div className="py-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-3">Choose a color</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {THEME_COLORS.map((color) => (
                      <button key={color} onClick={() => { saveSetting('accent_color', color); setAccentHexInput(''); }}
                        className="w-7 h-7 rounded-full transition-all duration-150 hover:scale-110"
                        style={{ backgroundColor: color, outline: settings.accent_color === color ? `2px solid ${color}` : '2px solid transparent', outlineOffset: '2px' }} />
                    ))}
                    <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors relative overflow-hidden" title="Custom color">
                      <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={settings.accent_color} onChange={(e) => { saveSetting('accent_color', e.target.value); setAccentHexInput(e.target.value); }} />
                      <span className="text-gray-400 text-xs font-bold pointer-events-none">+</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg border border-gray-200 flex-shrink-0" style={{ backgroundColor: settings.accent_color }} />
                  <input type="text" placeholder="#ED64A6" value={accentHexInput} onChange={(e) => handleAccentHexChange(e.target.value)} maxLength={7}
                    className="w-32 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all" />
                  <span className="text-xs text-gray-400">Custom hex</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Card size</p>
                  <div className="relative w-48">
                    <select value={settings.card_size || 'medium'} onChange={(e) => saveSetting('card_size', e.target.value)} className={selectClass}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </SectionGroup>

            <SectionGroup title="Typography">
              <div className="py-4 space-y-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Body Font</p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <select value={settings.font_family || ''} onChange={(e) => saveSetting('font_family', e.target.value)} className={selectClass}>
                        <option value="">Default (NoirPro)</option>
                        {settings.custom_font_name && <option value="custom">Custom: {settings.custom_font_name}</option>}
                        <option value="Lato">Lato</option>
                        <option value="Urbanist">Urbanist</option>
                        <option value="Spectral">Spectral</option>
                        <option value="Spectral SC">Spectral SC</option>
                        <option value="Playfair Display">Playfair Display</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <button onClick={() => bodyFontFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                      <Upload size={12} />Upload
                    </button>
                    <input ref={bodyFontFileRef} type="file" accept=".ttf,.otf,.woff2" onChange={handleBodyFontUpload} className="hidden" />
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-medium text-gray-500 mb-2">Heading Font</p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <select value={settings.heading_font || ''} onChange={(e) => saveSetting('heading_font', e.target.value)} className={selectClass}>
                        <option value="">Default (NoirPro)</option>
                        {settings.custom_heading_font_name && <option value="custom">Custom: {settings.custom_heading_font_name}</option>}
                        <option value="Lato">Lato</option>
                        <option value="Urbanist">Urbanist</option>
                        <option value="Spectral">Spectral</option>
                        <option value="Spectral SC">Spectral SC</option>
                        <option value="Playfair Display">Playfair Display</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <button onClick={() => headingFontFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                      <Upload size={12} />Upload
                    </button>
                    <input ref={headingFontFileRef} type="file" accept=".ttf,.otf,.woff2" onChange={handleHeadingFontUpload} className="hidden" />
                  </div>
                </div>
              </div>
            </SectionGroup>
          </>
        );

      // ── OTHERS: Data + Updates + Trash + Account ──────────────────────────
      case 'Others':
        return (
          <>
            <SectionGroup title="Data">
              <SettingRow icon={Upload} title="Export Data" description="Download all clients and tasks as CSV"
                action={<button onClick={handleExportData} className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">Export</button>}
              />
              <SettingRow icon={CreditCard} title="Export Payments" description="Download paid task and retainer records"
                action={<button onClick={handleExportPayments} className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">Export</button>}
              />
              <SettingRow icon={Database} title="Import Data" description="Import from a WorkBoard-format CSV" border={false}
                action={
                  <>
                    <button onClick={() => importFileRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-60">
                      {importing ? <><RefreshCw size={12} className="animate-spin" />Importing…</> : <><Upload size={12} />Choose file</>}
                    </button>
                    <input ref={importFileRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
                  </>
                }
              />
            </SectionGroup>

            <SectionGroup title="Updates">
              <SettingRow icon={Sparkles} title="What's New" description="Latest release highlights"
                action={<button onClick={() => setWhatsNewOpen(true)} className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">View</button>}
              />
              <SettingRow icon={History} title="Changelog" description="Full version history" border={false}
                action={<button onClick={() => setChangelogOpen(true)} className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">View</button>}
              />
            </SectionGroup>

            <SectionGroup title="Trash · deleted after 45 days">
              <div className="py-2">
                {trash.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Trash is empty</p>
                ) : (
                  <>
                    <div className="flex justify-end py-2">
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Permanently delete all ${trash.length} item${trash.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
                          await Promise.all(trash.map((item) => deleteForever(item.id)));
                          showToast('Trash cleared');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={11} />Clear all
                      </button>
                    </div>
                    <div className="space-y-2 pb-2">
                      {trash.map((item) => {
                        const daysLeft = Math.ceil((new Date(item.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{item.item_name}</p>
                              <p className="text-xs text-gray-400">
                                {item.item_type === 'client' ? (settings.clients_label || 'Client') : item.item_type === 'task_group' ? 'Task Group' : item.item_type === 'standalone_task' ? 'Standalone Task' : 'Task'} · {daysLeft}d left
                              </p>
                            </div>
                            <button onClick={() => handleRestore(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
                              <RotateCcw size={11} />Restore
                            </button>
                            <button onClick={() => handleDeleteForever(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                              <Trash2 size={11} />Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </SectionGroup>

            <SectionGroup title="Account">
              {!IS_DEMO && user ? (
                <SettingRow icon={User} title={user.email} description="Signed in" border={false}
                  action={
                    <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--accent)' }}>
                      <LogOut size={13} />Sign Out
                    </button>
                  }
                />
              ) : (
                <p className="text-sm text-gray-400 py-6 text-center">Not signed in</p>
              )}
            </SectionGroup>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex min-h-screen page-enter">

        {/* ── Left nav (desktop) ── */}
        <div className="hidden md:flex flex-col w-52 flex-shrink-0 p-6 pt-8 border-r border-gray-100 bg-white/50">
          <h1 className="font-display text-xl font-bold text-gray-900 mb-6">Settings</h1>
          <div className="space-y-1">
            {NAV.map(({ items }) =>
              items.map((item) => (
                <NavItem key={item} label={item} active={activeSection === item} onClick={() => setActiveSection(item)} />
              ))
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto max-w-2xl">

          {/* Mobile: section title + breadcrumb */}
          <div className="md:hidden mb-6">
            <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 mt-1">Settings / {activeSection}</p>
          </div>

          {/* Desktop breadcrumb */}
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-400 mb-8">
            <span>Settings</span>
            <ChevronRight size={14} />
            <span className="text-gray-700 font-medium">{activeSection}</span>
          </div>

          {/* Mobile: nav as horizontal scroll pills */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
            {NAV.flatMap(({ items }) => items).map((item) => (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeSection === item ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                style={activeSection === item ? { backgroundColor: 'var(--accent)' } : {}}
              >
                {item}
              </button>
            ))}
          </div>

          {renderSection()}
        </div>
      </div>

      {whatsNewOpen && <WhatsNewPopup open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />}
      {changelogOpen && <ChangelogPopup open={changelogOpen} onClose={() => setChangelogOpen(false)} />}
    </>
  );
}

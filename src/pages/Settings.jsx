import { useState, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Upload, RefreshCw, Trash2, RotateCcw, X, Palette, User, Image, Type,
  Monitor, Sparkles, History, Database, LogOut,
} from 'lucide-react';
import WhatsNewPopup from '../components/WhatsNewPopup';
import ChangelogPopup from '../components/ChangelogPopup';
import { supabase } from '../lib/supabase';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

const THEME_COLORS = [
  '#ED64A6', '#F56565', '#ED8936', '#38B2AC',
  '#9F7AEA', '#ED64A6', '#48BB78', '#4299E1',
];

const CARD_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
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
    { value: 'dual',    label: 'Dual',         description: `Both ${cl} and Tasks visible` },
    { value: 'clients', label: `${cl} Only`,   description: 'Tasks hidden from sidebar' },
    { value: 'tasks',   label: 'Tasks Only',   description: `${cl} hidden from sidebar` },
  ];

  const [clientsLabelInput, setClientsLabelInput] = useState(settings.clients_label || 'Clients');
  const [refreshing, setRefreshing] = useState(false);
  const [accentHexInput, setAccentHexInput] = useState('');
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const importFileRef = useRef(null);
  const changelogTriggerRef = useRef(null);
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
    const timer = setTimeout(() => {
      toastId = showToast('Restored successfully, refreshing...');
    }, 1000);

    if (refetch) await refetch();
    clearTimeout(timer);
    if (toastId !== null) dismissToast(toastId);

    if (result?.autoRestoredClient) {
      showToast('Client and task restored');
    } else {
      showToast(`"${item.item_name}" restored`);
    }
  };

  const handleDeleteForever = async (item) => {
    await deleteForever(item.id);
    showToast(`"${item.item_name}" permanently deleted`);
  };

  // ── Export Data ──
  const handleExportData = () => {
    const headers = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at';
    const rows = [];
    (clients || []).forEach((client) => {
      if (!client.tasks || client.tasks.length === 0) {
        rows.push(rowToCSV([
          client.name,
          client.color || '',
          client.retainer || 0,
          '', '', '', '', '', '', '',
        ]));
      } else {
        client.tasks.forEach((task) => {
          rows.push(rowToCSV([
            client.name,
            client.color || '',
            client.retainer || 0,
            task.title || '',
            task.done ? 'true' : 'false',
            task.paid ? 'true' : 'false',
            task.amount || 0,
            task.currency || 'NGN',
            task.deadline || '',
            task.createdAt || '',
          ]));
        });
      }
    });
    const csv = [headers, ...rows].join('\n');
    downloadCSV(`workboard-export-${todayStr()}.csv`, csv);
  };

  // ── Export Payments ──
  const handleExportPayments = () => {
    const headers = 'client_name,task_title,amount,currency,type,month,paid_at';
    const rows = [];
    (clients || []).forEach((client) => {
      // Task payments
      (client.tasks || []).forEach((task) => {
        if (task.paid) {
          rows.push(rowToCSV([
            client.name,
            task.title || '',
            task.amount || 0,
            task.currency || 'NGN',
            'task',
            '',
            '',
          ]));
        }
      });
      // Retainer payments
      if (client.retainerPaid && typeof client.retainerPaid === 'object') {
        Object.entries(client.retainerPaid).forEach(([month, paid]) => {
          if (paid) {
            rows.push(rowToCSV([
              client.name,
              '',
              client.retainer || 0,
              'NGN',
              'retainer',
              month,
              '',
            ]));
          }
        });
      }
    });
    const csv = [headers, ...rows].join('\n');
    downloadCSV(`workboard-payments-${todayStr()}.csv`, csv);
  };

  // ── Import Data ──
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-imported if needed
    e.target.value = '';

    if (IS_DEMO) {
      showToast('Import is disabled in demo mode');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) throw new Error('CSV appears to be empty or has no data rows');

      const headerLine = lines[0];
      const expectedHeaders = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at';
      if (headerLine.trim() !== expectedHeaders) {
        throw new Error('CSV headers do not match the expected WorkBoard export format');
      }

      // Parse rows
      const dataRows = lines.slice(1).map((line) => {
        // Simple CSV parse — split by comma, handle quoted fields
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            fields.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
        fields.push(current);
        return {
          client_name: fields[0] || '',
          client_color: fields[1] || '#ED64A6',
          retainer_amount: fields[2] || '0',
          task_title: fields[3] || '',
          task_done: fields[4] || 'false',
          task_paid: fields[5] || 'false',
          task_amount: fields[6] || '0',
          task_currency: fields[7] || 'NGN',
          task_deadline: fields[8] || '',
          task_created_at: fields[9] || '',
        };
      });

      // Group by client name
      const grouped = {};
      dataRows.forEach((row) => {
        if (!row.client_name) return;
        if (!grouped[row.client_name]) grouped[row.client_name] = [];
        grouped[row.client_name].push(row);
      });

      let clientsImported = 0;
      let tasksImported = 0;

      for (const [clientName, rows] of Object.entries(grouped)) {
        // Check if client already exists
        const existing = (clients || []).find(
          (c) => c.name.toLowerCase() === clientName.toLowerCase()
        );

        let clientId;
        if (existing) {
          clientId = existing.id;
        } else {
          const firstRow = rows[0];
          const { data: newClient, error: cErr } = await supabase
            .from('clients')
            .insert({
              name: clientName,
              color: firstRow.client_color || '#ED64A6',
              retainer: parseFloat(firstRow.retainer_amount) || 0,
              user_id: user?.id,
            })
            .select()
            .single();
          if (cErr) throw cErr;
          clientId = newClient.id;
          clientsImported++;
        }

        // Insert tasks
        for (const row of rows) {
          if (!row.task_title) continue;
          const { error: tErr } = await supabase.from('tasks').insert({
            client_id: clientId,
            title: row.task_title,
            done: row.task_done === 'true',
            paid: row.task_paid === 'true',
            amount: parseFloat(row.task_amount) || 0,
            currency: row.task_currency || 'NGN',
            deadline: row.task_deadline || null,
            user_id: user?.id,
          });
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

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 page-enter max-w-3xl overflow-x-hidden">
        <h1 className="font-display text-2xl lg:text-[2.75rem] leading-tight font-bold text-gray-900 mb-6 lg:mb-8">
          Settings
        </h1>

        {/* Profile Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-gray-400" />
            <h2 className="font-display text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Your Name</label>
              <input
                type="text"
                value={settings.username}
                onChange={(e) => saveSetting('username', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Company Name</label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => saveSetting('company_name', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Workspace Mode Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Monitor size={18} className="text-gray-400" />
            <h2 className="font-display text-lg font-semibold text-gray-900">Workspace Mode</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {APP_MODES.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => saveSetting('app_mode', value)}
                className={`rounded-xl p-4 text-left border-2 transition-all ${
                  currentMode === value
                    ? 'border-transparent'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
                style={
                  currentMode === value
                    ? { borderColor: 'var(--accent, #ED64A6)', backgroundColor: 'var(--accent, #ED64A6)08' }
                    : {}
                }
              >
                <p
                  className="text-sm font-semibold mb-1"
                  style={currentMode === value ? { color: 'var(--accent, #ED64A6)' } : { color: '#374151' }}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-400 leading-snug">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Appearance Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Palette size={18} className="text-gray-400" />
            <h2 className="font-display text-lg font-semibold text-gray-900">Appearance</h2>
          </div>

          <div className="space-y-6">
            {/* Section Label */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                Clients Section Label
              </label>
              <input
                type="text"
                value={clientsLabelInput}
                onChange={(e) => setClientsLabelInput(e.target.value)}
                onBlur={(e) => saveSetting('clients_label', e.target.value.trim() || 'Clients')}
                placeholder="Clients"
                className="w-56 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all"
              />
              <p className="text-xs text-gray-400 mt-1">
                Renames "Clients" everywhere in the app
              </p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Sidebar Logo</label>
              <div className="flex items-center gap-4">
                {settings.logo ? (
                  <div className="relative group">
                    <img src={settings.logo} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                    <Image size={18} />
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Upload size={14} />
                  Upload
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <span className="text-xs text-gray-400">Max 500KB, PNG or JPG</span>
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Accent Color</label>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => { saveSetting('accent_color', color); setAccentHexInput(''); }}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-150 hover:scale-105"
                    style={{
                      backgroundColor: color,
                      outline: settings.accent_color === color ? `3px solid ${color}` : '3px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {accentHexInput && isValidHex(accentHexInput) && (
                  <div className="w-7 h-7 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: normalizeHex(accentHexInput) }} />
                )}
                <input
                  type="text"
                  placeholder="#667EEA"
                  value={accentHexInput}
                  onChange={(e) => handleAccentHexChange(e.target.value)}
                  maxLength={7}
                  className="w-28 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all flex-shrink-0"
                />
                <span className="text-xs text-gray-400">Custom hex</span>
              </div>
            </div>

            {/* Dashboard Heading */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Dashboard Heading</label>
              <textarea
                value={settings.dashboard_heading}
                onChange={(e) => saveSetting('dashboard_heading', e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all resize-none"
                placeholder={`Track your\nwork & earnings`}
              />
            </div>

            {/* Dashboard Subtitle */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Dashboard Subtitle</label>
              <input
                type="text"
                value={settings.dashboard_subtitle}
                onChange={(e) => saveSetting('dashboard_subtitle', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all"
                placeholder="Optional subtitle text"
              />
            </div>

            {/* Card Size */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Dashboard Card Size</label>
              <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {CARD_SIZES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => saveSetting('card_size', value)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-all duration-150 ${
                      settings.card_size === value ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={settings.card_size === value ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Font */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Body Font</label>
              <select
                value={settings.font_family || ''}
                onChange={(e) => saveSetting('font_family', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all mb-2"
              >
                <option value="">Default (DM Sans)</option>
                {settings.custom_font_name && <option value="custom">Custom: {settings.custom_font_name}</option>}
                <option value="Lato">Lato</option>
                <option value="Urbanist">Urbanist</option>
                <option value="Spectral">Spectral</option>
                <option value="Spectral SC">Spectral SC</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => bodyFontFileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Type size={14} />
                  Upload Body Font
                </button>
                <input ref={bodyFontFileRef} type="file" accept=".ttf,.otf,.woff2" onChange={handleBodyFontUpload} className="hidden" />
                <span className="text-xs text-gray-400">.ttf, .otf, .woff2 — max 2MB</span>
              </div>
            </div>

            {/* Heading Font */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Heading Font</label>
              <select
                value={settings.heading_font || ''}
                onChange={(e) => saveSetting('heading_font', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all mb-2"
              >
                <option value="">Default (Fraunces)</option>
                {settings.custom_heading_font_name && <option value="custom">Custom: {settings.custom_heading_font_name}</option>}
                <option value="Lato">Lato</option>
                <option value="Urbanist">Urbanist</option>
                <option value="Spectral">Spectral</option>
                <option value="Spectral SC">Spectral SC</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => headingFontFileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Type size={14} />
                  Upload Heading Font
                </button>
                <input ref={headingFontFileRef} type="file" accept=".ttf,.otf,.woff2" onChange={handleHeadingFontUpload} className="hidden" />
                <span className="text-xs text-gray-400">.ttf, .otf, .woff2 — max 2MB</span>
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Currency</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { code: 'NGN', label: '₦ NGN' },
                  { code: 'USD', label: '$ USD' },
                  { code: 'GBP', label: '£ GBP' },
                  { code: 'EUR', label: '€ EUR' },
                ].map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => saveSetting('currency', code)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                      settings.currency === code
                        ? 'text-white border-transparent'
                        : 'text-gray-500 border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                    style={settings.currency === code ? { backgroundColor: 'var(--accent, #ED64A6)', borderColor: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                <button
                  onClick={handleRefreshRate}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                  Refresh rates
                </button>
                {settings.exchange_rate_updated_at && (
                  <span className="text-xs text-gray-400">Updated {settings.exchange_rate_updated_at}</span>
                )}
                {(() => {
                  let rates = null;
                  try { rates = JSON.parse(settings.exchange_rates); } catch { /* ignore */ }
                  if (!rates) return null;
                  return (
                    <span className="text-xs text-gray-400 font-mono">
                      1 USD = ₦{(rates.NGN || 0).toLocaleString()} · £{(rates.GBP || 0).toFixed(2)} · €{(rates.EUR || 0).toFixed(2)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>

        {/* ── Data section ── */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-gray-400" />
            <h2 className="font-display text-lg font-semibold text-gray-800">Data</h2>
          </div>
          <div className="space-y-4">
            {/* Export buttons row */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--accent, #ED64A6)', color: 'var(--accent, #ED64A6)' }}
              >
                <Upload size={14} />
                Export Data
              </button>
              <button
                onClick={handleExportPayments}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--accent, #ED64A6)', color: 'var(--accent, #ED64A6)' }}
              >
                <Upload size={14} />
                Export Payments
              </button>
            </div>

            {/* Import button + note */}
            <div>
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--accent, #ED64A6)', color: 'var(--accent, #ED64A6)' }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    Import Data
                  </>
                )}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                onChange={handleImportFile}
                className="hidden"
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Import expects the same format as the WorkBoard export file.
              </p>
            </div>
          </div>
        </section>

        {/* What's New Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gray-400" />
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900">What's New</h2>
                <p className="text-xs text-gray-400 mt-0.5">View the latest release highlights</p>
              </div>
            </div>
            <button
              onClick={() => setWhatsNewOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <Sparkles size={14} />
              What's New
            </button>
          </div>
        </section>

        {/* Changelog Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900">Changelog</h2>
                <p className="text-xs text-gray-400 mt-0.5">View version history and release notes</p>
              </div>
            </div>
            <button
              onClick={() => changelogTriggerRef.current?.querySelector('button')?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <History size={14} />
              View Changelog
            </button>
          </div>
        </section>

        {/* Account Section */}
        {!IS_DEMO && user && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-gray-400" />
              <h2 className="font-display text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-gray-700 font-medium">{user.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Signed in</p>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-danger text-danger hover:bg-danger/5 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </section>
        )}

        {/* Trash Section */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Trash2 size={18} className="text-gray-400" />
            <h2 className="font-display text-lg font-semibold text-gray-900">Trash</h2>
            <span className="text-xs text-gray-400 ml-1">Items are permanently deleted after 45 days</span>
          </div>

          {trash.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Trash is empty</p>
          ) : (
            <div className="space-y-2">
              {trash.map((item) => {
                const daysLeft = Math.ceil(
                  (new Date(item.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2.5 px-3 sm:py-3 sm:px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.item_name}</p>
                      <p className="text-xs text-gray-400">
                        {item.item_type === 'client' ? (settings.clients_label || 'Client') :
                         item.item_type === 'task_group' ? 'Task Group' :
                         item.item_type === 'standalone_task' ? 'Standalone Task' : 'Task'} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                    >
                      <RotateCcw size={12} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteForever(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger/10 hover:bg-danger/20 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {whatsNewOpen && (
        <WhatsNewPopup open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      )}
      {/* ChangelogPopup only on this page — hidden floating trigger, controlled via card button */}
      <div ref={changelogTriggerRef}>
        <ChangelogPopup />
      </div>
    </>
  );
}

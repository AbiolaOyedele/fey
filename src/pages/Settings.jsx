import { useState, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Upload, RefreshCw, Trash2, RotateCcw, X, Palette, User, Image, Type } from 'lucide-react';

const THEME_COLORS = [
  '#667EEA', '#F56565', '#ED8936', '#38B2AC',
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

  const [refreshing, setRefreshing] = useState(false);
  const [accentHexInput, setAccentHexInput] = useState('');
  const fileInputRef = useRef(null);
  const bodyFontFileRef = useRef(null);
  const headingFontFileRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      saveSetting('logo', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    saveSetting('logo', '');
  };

  const handleRefreshRate = async () => {
    setRefreshing(true);
    await refreshExchangeRate();
    setRefreshing(false);
    showToast('Exchange rate updated');
  };

  const handleAccentHexChange = (val) => {
    setAccentHexInput(val);
    if (isValidHex(val)) {
      saveSetting('accent_color', normalizeHex(val));
    }
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

    if (result?.error) {
      showToast(`Restore failed: ${result.error}`);
      return;
    }

    // Show "refreshing" toast if refetch takes more than 1 second
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

  return (
    <div className="p-8 page-enter max-w-3xl">
      <h1 className="font-display text-[2.75rem] leading-tight font-bold text-gray-900 mb-8">
        Settings
      </h1>

      {/* Profile Section */}
      <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} className="text-gray-400" />
          <h2 className="font-display text-lg font-semibold text-gray-900">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
              Your Name
            </label>
            <input
              type="text"
              value={settings.username}
              onChange={(e) => saveSetting('username', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': 'var(--accent, #667EEA)' }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
              Company Name
            </label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => saveSetting('company_name', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-5">
          <Palette size={18} className="text-gray-400" />
          <h2 className="font-display text-lg font-semibold text-gray-900">Appearance</h2>
        </div>

        <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Sidebar Logo
            </label>
            <div className="flex items-center gap-4">
              {settings.logo ? (
                <div className="relative group">
                  <img
                    src={settings.logo}
                    alt="Logo"
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200"
                  />
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <span className="text-xs text-gray-400">Max 500KB, PNG or JPG</span>
            </div>
          </div>

          {/* Theme / Accent Color */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Accent Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {THEME_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    saveSetting('accent_color', color);
                    setAccentHexInput('');
                  }}
                  className="w-8 h-8 rounded-full transition-all duration-150 hover:scale-105"
                  style={{
                    backgroundColor: color,
                    outline: settings.accent_color === color ? `3px solid ${color}` : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
            {/* Custom hex input */}
            <div className="flex items-center gap-2 mt-3">
              {accentHexInput && isValidHex(accentHexInput) && (
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 border border-gray-200"
                  style={{ backgroundColor: normalizeHex(accentHexInput) }}
                />
              )}
              <input
                type="text"
                placeholder="#667EEA"
                value={accentHexInput}
                onChange={(e) => handleAccentHexChange(e.target.value)}
                maxLength={7}
                className="w-28 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all"
              />
              <span className="text-xs text-gray-400">Custom hex</span>
            </div>
          </div>

          {/* Dashboard Heading */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
              Dashboard Heading
            </label>
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
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
              Dashboard Subtitle
            </label>
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
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Dashboard Card Size
            </label>
            <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              {CARD_SIZES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => saveSetting('card_size', value)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all duration-150 ${
                    settings.card_size === value
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={settings.card_size === value ? { backgroundColor: 'var(--accent, #667EEA)' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Body Font */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Body Font
            </label>
            <select
              value={settings.font_family || ''}
              onChange={(e) => saveSetting('font_family', e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all mb-2"
            >
              <option value="">Default (DM Sans)</option>
              {settings.custom_font_name && (
                <option value="custom">Custom: {settings.custom_font_name}</option>
              )}
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
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Heading Font
            </label>
            <select
              value={settings.heading_font || ''}
              onChange={(e) => saveSetting('heading_font', e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all mb-2"
            >
              <option value="">Default (Fraunces)</option>
              {settings.custom_heading_font_name && (
                <option value="custom">Custom: {settings.custom_heading_font_name}</option>
              )}
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

          {/* Currency Toggle */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Currency
            </label>
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => saveSetting('currency', 'NGN')}
                  className={`px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                    settings.currency === 'NGN'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={settings.currency === 'NGN' ? { backgroundColor: 'var(--accent, #667EEA)' } : {}}
                >
                  ₦ NGN
                </button>
                <button
                  onClick={() => saveSetting('currency', 'USD')}
                  className={`px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                    settings.currency === 'USD'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={settings.currency === 'USD' ? { backgroundColor: 'var(--accent, #667EEA)' } : {}}
                >
                  $ USD
                </button>
              </div>

              {settings.currency === 'USD' && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-mono">
                    1 USD = ₦{Number(settings.exchange_rate).toLocaleString()}
                  </span>
                  <button
                    onClick={handleRefreshRate}
                    disabled={refreshing}
                    className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                  {settings.exchange_rate_updated_at && (
                    <span className="text-xs text-gray-400">
                      Updated {settings.exchange_rate_updated_at}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trash Section */}
      <section className="bg-white rounded-2xl shadow-sm p-6">
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
                  className="flex items-center gap-3 py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.item_name}</p>
                    <p className="text-xs text-gray-400">
                      {item.item_type === 'client' ? 'Client' : 'Task'} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: 'var(--accent, #667EEA)' }}
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
  );
}

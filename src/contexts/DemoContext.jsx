/**
 * DemoContext — provides the same SettingsContext interface as SettingsContext.jsx
 * but backed entirely by in-memory state. No Supabase reads or writes occur.
 *
 * Also exposes DemoDataContext so App.jsx can read client / task-group data
 * from the same useDemoData instance that powers the SettingsContext trash helpers.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDemoData } from '../hooks/useDemoData';
import { SettingsContext } from './SettingsContext';
import { DEMO_SETTINGS } from '../data/demoData';

// ── DemoDataContext ────────────────────────────────────────────────────────────
// App.jsx reads from this when VITE_DEMO_MODE is true.
export const DemoDataContext = createContext(null);
export const useDemoDataCtx  = () => useContext(DemoDataContext);

// ── DemoProvider ──────────────────────────────────────────────────────────────
export function DemoProvider({ children }) {
  const [settings, setSettings] = useState({ ...DEMO_SETTINGS });
  const [toasts,   setToasts]   = useState([]);

  // All client / task-group state lives here
  const demoData = useDemoData();

  // Apply accent color CSS variable (same as SettingsProvider)
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent_color);
  }, [settings.accent_color]);

  // Apply body font (mirrors SettingsContext logic)
  useEffect(() => {
    if (!settings.font_family) {
      document.documentElement.style.setProperty('--body-font', "'DM Sans', 'Noto Sans', sans-serif");
      return;
    }
    if (settings.font_family === 'custom') {
      if (!settings.custom_font) return;
      const fontName = settings.custom_font_name || 'CustomBodyFont';
      let style = document.getElementById('custom-body-font-face');
      if (!style) {
        style = document.createElement('style');
        style.id = 'custom-body-font-face';
        document.head.appendChild(style);
      }
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${settings.custom_font}'); }`;
      document.documentElement.style.setProperty('--body-font', `'${fontName}', 'Noto Sans', sans-serif`);
    }
  }, [settings.font_family, settings.custom_font, settings.custom_font_name]);

  // Apply heading font (mirrors SettingsContext logic)
  useEffect(() => {
    if (!settings.heading_font) {
      document.documentElement.style.setProperty('--heading-font', "'Fraunces', 'Noto Sans', serif");
      return;
    }
    if (settings.heading_font === 'custom') {
      if (!settings.custom_heading_font) return;
      const fontName = settings.custom_heading_font_name || 'CustomHeadingFont';
      let style = document.getElementById('custom-heading-font-face');
      if (!style) {
        style = document.createElement('style');
        style.id = 'custom-heading-font-face';
        document.head.appendChild(style);
      }
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${settings.custom_heading_font}'); }`;
      document.documentElement.style.setProperty('--heading-font', `'${fontName}', 'Noto Sans', sans-serif`);
    }
  }, [settings.heading_font, settings.custom_heading_font, settings.custom_heading_font_name]);

  // ── Settings mutations ────────────────────────────────────────────────────
  const saveSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshExchangeRate = useCallback(async () => {
    try {
      const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data?.rates?.NGN) {
        const rate = data.rates.NGN;
        const now  = new Date().toISOString().split('T')[0];
        setSettings((prev) => ({ ...prev, exchange_rate: rate, exchange_rate_updated_at: now }));
      }
    } catch {
      // fail silently — demo still works with default rate
    }
  }, []);

  // Fetch live exchange rate on mount
  useEffect(() => { refreshExchangeRate(); }, [refreshExchangeRate]);

  // ── Currency helpers (same logic as SettingsContext) ──────────────────────
  const convertAmount = useCallback((amount, storedCurrency) => {
    const n  = Number(amount) || 0;
    const sc = storedCurrency || 'NGN';
    if (sc === settings.currency) return n;
    const rate = Number(settings.exchange_rate) || 1;
    if (sc === 'NGN' && settings.currency === 'USD') return n / rate;
    if (sc === 'USD' && settings.currency === 'NGN') return n * rate;
    return n;
  }, [settings.currency, settings.exchange_rate]);

  const formatMoney = useCallback((amount) => {
    const n = Number(amount) || 0;
    if (settings.currency === 'USD') {
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [settings.currency]);

  // ── Toast system ──────────────────────────────────────────────────────────
  const showToast = useCallback((message, action) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── SettingsContext value ─────────────────────────────────────────────────
  // Trash helpers are wired to useDemoData so they operate on local state.
  const settingsValue = {
    settings,
    settingsLoading: false,
    saveSetting,
    refreshExchangeRate,
    convertAmount,
    formatMoney,
    trash: [],
    trashClient:           demoData.trashClient,
    trashTask:             demoData.trashTask,
    trashGroup:            demoData.taskGroupData.trashGroup,
    trashStandaloneTask:   demoData.taskGroupData.trashStandaloneTask,
    restoreFromTrash:      async () => ({ success: true }),
    deleteForever:         async () => {},
    toasts,
    showToast,
    dismissToast,
  };

  return (
    <SettingsContext.Provider value={settingsValue}>
      <DemoDataContext.Provider value={demoData}>
        {children}
      </DemoDataContext.Provider>
    </SettingsContext.Provider>
  );
}

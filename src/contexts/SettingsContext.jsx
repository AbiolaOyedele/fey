import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const SettingsContext = createContext(null);

const DEFAULT_CHANGELOG = [
  {
    version: '1.9.0', date: '26 Apr, 2026',
    features: [
      'Client contact details — store email, phone, website, tax ID, and address per client from the Edit modal',
    ],
    improvements: [
      'Invoice Bill To section now auto-populates from saved client contact details when selecting a client',
      'Shared invoice now displays website and Tax ID fields in the From and Bill To sections',
    ],
    fixes: [
      'Invoice From/Bill To text misalignment in shared and downloaded invoices fixed (switched to flexbox layout for reliable PDF rendering)',
    ],
  },
  {
    version: '1.8.0', date: '25 April 2026',
    features: [
      'Full invoicing system — create, send, and track invoices',
      'Invoice builder with 4 layouts and inline editing',
      'Three creation paths: from tasks, from client, or blank',
      'Shareable invoice links — clients can view without an account',
      'PDF export via browser print dialog',
      'Settings expanded to 8 tabs: Profile, Branding, Business Info, Payments, General, Emails, Integrations, Billing',
      'Avatar and cover image upload in Profile settings',
      'Payment template builder in Payments settings',
      'Getting Started checklist widget with auto-completion detection',
    ],
    improvements: [
      'Invoices nav item added to sidebar (desktop and mobile)',
      'Business info in settings feeds directly into invoice FROM section',
    ],
    fixes: [],
  },
  {
    version: '1.7.0', date: '18 April 2026',
    features: [
      'Client workspace sharing with one-click shareable links',
      'Public shared workspace for recipients (no account needed)',
      'Per-member view/edit permission controls',
      'Members panel in client workspace right sidebar',
      'Task-only dashboard with completion rings and group cards',
      'Tick off tasks directly from the task dashboard',
    ],
    improvements: [
      'All modals and popups now always center on screen (fixed stacking context bug)',
      'Sidebar logo navigates to dashboard instead of full page reload',
    ],
    fixes: ['Share link RLS bypass — cached client info in shared_clients table'],
  },
  {
    version: '1.6.1', date: '15 April 2026', features: [], improvements: [],
    fixes: ['Syntax error fix in SettingsContext restoreFromTrash function'],
  },
  {
    version: '1.6.0', date: 'April 2026',
    features: ['Tasks page with standalone task list and task groups', 'Task group workspace with full task management', 'App mode switch (Clients Only, Tasks Only, Dual)', 'Clients section label rename in settings', 'Task mode toggle on client pages', 'Changelog popup'],
    improvements: [], fixes: [],
  },
  {
    version: '1.5.0', date: 'April 2026',
    features: ['Task drag and drop with sort order persistence', 'Task filter dropdown (All, Overdue, Due Today, Due Tomorrow)', 'Sentence case auto-formatting on task save', 'Pastel color randomisation for new clients'],
    improvements: [], fixes: [],
  },
  {
    version: '1.4.2', date: 'April 2026', features: [], improvements: [],
    fixes: ['Drag and drop click conflict on client cards', 'Task row icon alignment', 'Horizontal overflow layout fix'],
  },
  {
    version: '1.4.1', date: 'April 2026', features: [],
    improvements: ['Currency input decimal support and comma formatting'],
    fixes: [],
  },
  {
    version: '1.4.0', date: 'April 2026',
    features: ['Deadline tracking on tasks with calendar picker', 'Overdue button with red badge in dashboard', 'Dashboard tab restructure with filter tabs', 'Currency conversion system (NGN / USD)'],
    improvements: [], fixes: [],
  },
  {
    version: '1.3.0', date: 'April 2026',
    features: ['Font system with Google Fonts and custom font upload', 'Client logos support', 'Drag and drop client card reordering', 'Overdue indicators on client cards and workspace', 'Notification bell with upcoming deadlines'],
    improvements: [], fixes: [],
  },
  {
    version: '1.2.0', date: 'April 2026',
    features: ['Settings page with full appearance controls', 'Trash with 45-day retention and one-click restore', 'Accent color theming applied globally'],
    improvements: [], fixes: [],
  },
  {
    version: '1.1.0', date: 'April 2026',
    features: ['Migrated from localStorage to Supabase', 'Data persists across devices and sessions'],
    improvements: [], fixes: [],
  },
  {
    version: '1.0.0', date: 'April 2026',
    features: ['Initial build with React, Vite, Tailwind CSS', 'Dashboard overview with earnings tracking', 'Clients management with task tracking', 'Payments history page', 'Data stored in localStorage'],
    improvements: [], fixes: [],
  },
];

const DEFAULTS = {
  username: '',
  company_name: '',
  logo: '',
  dashboard_heading: 'Track your\nwork & earnings',
  dashboard_subtitle: '',
  accent_color: '#ED64A6',
  card_size: 'medium',
  currency: 'NGN',
  exchange_rate: 1500,
  exchange_rates: '{"USD":1,"NGN":1500,"GBP":0.78,"EUR":0.92}',
  exchange_rate_updated_at: '',
  font_family: '',
  custom_font: '',
  custom_font_name: '',
  heading_font: '',
  custom_heading_font: '',
  custom_heading_font_name: '',
  client_order: '',
  clients_label: 'Clients',
  app_mode: 'dual',
  changelog: JSON.stringify(DEFAULT_CHANGELOG),
  whats_new_active: 'false',
  whats_new_version: '',
  onboarding_complete: 'false',
  // Profile
  avatar_url: '',
  hourly_rate: '',
  // Branding
  cover_image: '',
  invoice_layout: 'left_aligned',
  invoice_font_color: '#1a1a1a',
  invoice_bg_color: '#ffffff',
  page_bg_type: 'color',
  page_bg_color: '#f9fafb',
  page_bg_image: '',
  // Business Info
  business_email: '',
  business_phone: '',
  business_website: '',
  business_address: '',
  tax_id: '',
  // Payments
  payment_templates: '[]',
  show_payment_on_docs: 'true',
  // General
  invoice_language: 'English',
  default_tax_rate: '',
  invoice_prefix: 'INV-',
  invoice_next: '001',
  quote_prefix: 'QT-',
  quote_next: '001',
  receipt_prefix: 'REC-',
  receipt_next: '001',
  include_date_in_number: 'false',
  payment_terms_days: '14',
  quote_valid_days: '30',
  date_format: 'MM/DD/YYYY',
  default_invoice_notes: '',
  auto_generate_receipt: 'false',
  revoke_link_on_payment: 'false',
  // Emails
  email_acceptance: 'true',
  email_payment_received: 'true',
  email_stripe: 'true',
  email_project_activity: 'false',
  email_chat_from: 'true',
  email_chat_to: 'true',
  email_auto_reminders: 'false',
  // Onboarding checklist
  checklist_dismissed: 'false',
  checklist_steps: '{}',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [trash, setTrash] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [userId, setUserId] = useState(null);

  // Get current user id
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load settings when userId is known
  useEffect(() => {
    if (userId === null) return; // not authenticated yet

    (async () => {
      setSettingsLoading(true);
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('user_id', userId);
        if (error) throw error;
        if (data && data.length > 0) {
          const merged = { ...DEFAULTS };
          data.forEach((row) => {
            if (row.key in merged) merged[row.key] = row.value;
          });
          merged.exchange_rate = Number(merged.exchange_rate) || 1;
          // localStorage fallback — if user has ever completed onboarding on this
          // device, honour that even if the DB row is missing (RLS / network / etc.)
          if (merged.onboarding_complete !== 'true') {
            const localFlag = localStorage.getItem(`wb:onboarding_complete:${userId}`);
            if (localFlag === 'true') merged.onboarding_complete = 'true';
          }
          setSettings(merged);
        } else {
          // No rows returned — still honour localStorage fallback if present
          const localFlag = localStorage.getItem(`wb:onboarding_complete:${userId}`);
          setSettings({
            ...DEFAULTS,
            onboarding_complete: localFlag === 'true' ? 'true' : 'false',
          });
        }
      } catch (err) {
        console.warn('[settings] load failed', err);
        // On error, still honour local onboarding flag
        const localFlag = localStorage.getItem(`wb:onboarding_complete:${userId}`);
        setSettings({
          ...DEFAULTS,
          onboarding_complete: localFlag === 'true' ? 'true' : 'false',
        });
      }

      // Load trash
      try {
        const { data } = await supabase
          .from('trash')
          .select('*')
          .eq('user_id', userId)
          .order('deleted_at', { ascending: false });
        if (data) {
          const now = new Date();
          const expired = data.filter((t) => new Date(t.expires_at) <= now);
          const valid = data.filter((t) => new Date(t.expires_at) > now);
          if (expired.length > 0) {
            await supabase.from('trash').delete().in('id', expired.map((t) => t.id));
          }
          setTrash(valid);
        }
      } catch {
        // Ignore
      }

      setSettingsLoading(false);
    })();
  }, [userId]);

  // Apply accent color as CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent_color);
  }, [settings.accent_color]);

  // Apply body font via --body-font CSS variable
  useEffect(() => {
    if (!settings.font_family) {
      document.documentElement.style.setProperty('--body-font', "'NoirPro', sans-serif");
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
    } else {
      const existing = document.getElementById('google-body-font-link');
      if (existing) existing.remove();
      const link = document.createElement('link');
      link.id = 'google-body-font-link';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${settings.font_family.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
      document.documentElement.style.setProperty('--body-font', `'${settings.font_family}', 'Noto Sans', sans-serif`);
    }
  }, [settings.font_family, settings.custom_font, settings.custom_font_name]);

  // Apply heading font via --heading-font CSS variable
  useEffect(() => {
    if (!settings.heading_font) {
      document.documentElement.style.setProperty('--heading-font', "'NoirPro', sans-serif");
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
    } else {
      const existing = document.getElementById('google-heading-font-link');
      if (existing) existing.remove();
      const link = document.createElement('link');
      link.id = 'google-heading-font-link';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${settings.heading_font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
      document.documentElement.style.setProperty('--heading-font', `'${settings.heading_font}', 'Noto Sans', sans-serif`);
    }
  }, [settings.heading_font, settings.custom_heading_font, settings.custom_heading_font_name]);

  // Save a single setting scoped to user
  const saveSetting = useCallback(async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    // Mirror onboarding_complete to localStorage as a resilience fallback —
    // guarantees the user never sees onboarding twice even if the DB write fails.
    if (key === 'onboarding_complete' && userId) {
      try { localStorage.setItem(`wb:onboarding_complete:${userId}`, String(value)); }
      catch { /* storage unavailable */ }
    }
    if (!userId) return;
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: String(value), user_id: userId }, { onConflict: 'key,user_id' });
    if (error) console.warn('[settings] save failed', key, error);
  }, [userId]);

  // Refresh exchange rates for all 4 currencies (base: USD)
  const refreshExchangeRate = useCallback(async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data?.rates) {
        const rates = {
          USD: 1,
          NGN: data.rates.NGN || 1500,
          GBP: data.rates.GBP || 0.78,
          EUR: data.rates.EUR || 0.92,
        };
        const now = new Date().toISOString().split('T')[0];
        const ratesJson = JSON.stringify(rates);
        await saveSetting('exchange_rates', ratesJson);
        await saveSetting('exchange_rate', rates.NGN); // legacy compat
        await saveSetting('exchange_rate_updated_at', now);
        setSettings((prev) => ({
          ...prev,
          exchange_rates: ratesJson,
          exchange_rate: rates.NGN,
          exchange_rate_updated_at: now,
        }));
      }
    } catch {
      // Fail silently
    }
  }, [saveSetting]);

  // Convert amount from storedCurrency to display currency
  // All rates are relative to USD (e.g. {USD:1, NGN:1500, GBP:0.78, EUR:0.92})
  const convertAmount = useCallback((amount, storedCurrency) => {
    const n = Number(amount) || 0;
    const sc = storedCurrency || 'NGN';
    const dc = settings.currency || 'NGN';
    if (sc === dc) return n;
    let rates;
    try { rates = JSON.parse(settings.exchange_rates); } catch { rates = null; }
    if (rates && rates[sc] && rates[dc]) {
      return n * (rates[dc] / rates[sc]);
    }
    // Legacy fallback: NGN <-> USD only
    const rate = Number(settings.exchange_rate) || 1500;
    if (sc === 'NGN' && dc === 'USD') return n / rate;
    if (sc === 'USD' && dc === 'NGN') return n * rate;
    return n;
  }, [settings.currency, settings.exchange_rates, settings.exchange_rate]);

  const CURRENCY_SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };

  const formatMoney = useCallback((amount) => {
    const n = Number(amount) || 0;
    const symbol = CURRENCY_SYMBOLS[settings.currency] || '₦';
    return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [settings.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((message, action) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Trash helpers — all include user_id
  const trashClient = useCallback(async (client) => {
    if (!userId) return null;
    const payload = {
      item_type: 'client',
      item_name: client.name,
      item_data: JSON.stringify({ ...client }),
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      user_id: userId,
    };
    await supabase.from('tasks').delete().eq('client_id', client.id);
    await supabase.from('retainer_payments').delete().eq('client_id', client.id);
    await supabase.from('clients').delete().eq('id', client.id);
    const { data } = await supabase.from('trash').insert(payload).select().single();
    if (data) setTrash((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const trashTask = useCallback(async (task, clientId, clientName) => {
    if (!userId) return null;
    const payload = {
      item_type: 'task',
      item_name: task.title,
      item_data: JSON.stringify({ ...task, client_id: clientId, client_name: clientName }),
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      user_id: userId,
    };
    await supabase.from('tasks').delete().eq('id', task.id);
    const { data } = await supabase.from('trash').insert(payload).select().single();
    if (data) setTrash((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const restoreFromTrash = useCallback(async (trashItem, clients) => {
    if (!userId) return { error: 'Not authenticated' };
    const itemData = JSON.parse(trashItem.item_data);

    if (trashItem.item_type === 'client') {
      const { data: newClient, error: cErr } = await supabase
        .from('clients')
        .insert({ name: itemData.name, color: itemData.color, retainer: itemData.retainer || 0, user_id: userId })
        .select().single();
      if (cErr) return { error: cErr.message };
      if (itemData.tasks && itemData.tasks.length > 0) {
        await supabase.from('tasks').insert(
          itemData.tasks.map((t) => ({
            client_id: newClient.id, title: t.title, done: t.done, paid: t.paid,
            amount: t.amount, created_at: t.createdAt || new Date().toISOString(), user_id: userId,
          }))
        );
      }
      if (itemData.retainerPaid) {
        const rpRows = Object.entries(itemData.retainerPaid)
          .filter(([, paid]) => paid)
          .map(([month]) => ({ client_id: newClient.id, month, paid: true, user_id: userId }));
        if (rpRows.length > 0) await supabase.from('retainer_payments').insert(rpRows);
      }
      await supabase.from('trash').delete().eq('id', trashItem.id);
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
      return { success: true };

    } else if (trashItem.item_type === 'task') {
      const parentId = itemData.client_id;
      const parentExists = clients?.some((c) => c.id === parentId);

      if (!parentExists) {
        const parentTrashItem = trash.find((t) => {
          if (t.item_type !== 'client') return false;
          try { return JSON.parse(t.item_data).id === parentId; } catch { return false; }
        });

        if (parentTrashItem) {
          const parentData = JSON.parse(parentTrashItem.item_data);
          const { data: newClient, error: cErr } = await supabase
            .from('clients')
            .insert({ name: parentData.name, color: parentData.color, retainer: parentData.retainer || 0, user_id: userId })
            .select().single();
          if (cErr) return { error: cErr.message };
          if (parentData.tasks && parentData.tasks.length > 0) {
            await supabase.from('tasks').insert(
              parentData.tasks.map((t) => ({
                client_id: newClient.id, title: t.title, done: t.done, paid: t.paid,
                amount: t.amount, created_at: t.createdAt || new Date().toISOString(), user_id: userId,
              }))
            );
          }
          if (parentData.retainerPaid) {
            const rpRows = Object.entries(parentData.retainerPaid)
              .filter(([, paid]) => paid)
              .map(([month]) => ({ client_id: newClient.id, month, paid: true, user_id: userId }));
            if (rpRows.length > 0) await supabase.from('retainer_payments').insert(rpRows);
          }
          await supabase.from('trash').delete().in('id', [parentTrashItem.id, trashItem.id]);
          setTrash((prev) => prev.filter((t) => t.id !== parentTrashItem.id && t.id !== trashItem.id));
          return { success: true, autoRestoredClient: true, clientName: parentData.name };
        } else {
          const { data: newClient, error: cErr } = await supabase
            .from('clients')
            .insert({ name: itemData.client_name || 'Restored Client', color: '#F0FDF4', retainer: 0, user_id: userId })
            .select().single();
          if (cErr) return { error: cErr.message };
          await supabase.from('tasks').insert({
            client_id: newClient.id, title: itemData.title, done: itemData.done, paid: itemData.paid,
            amount: itemData.amount, created_at: itemData.createdAt || new Date().toISOString(), user_id: userId,
          });
          await supabase.from('trash').delete().eq('id', trashItem.id);
          setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
          return { success: true, autoRestoredClient: true, createdPlaceholder: true, clientName: itemData.client_name };
        }
      }

      await supabase.from('tasks').insert({
        client_id: parentId, title: itemData.title, done: itemData.done, paid: itemData.paid,
        amount: itemData.amount, created_at: itemData.createdAt || new Date().toISOString(), user_id: userId,
      });
      await supabase.from('trash').delete().eq('id', trashItem.id);
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
      return { success: true };

    } else if (trashItem.item_type === 'task_group') {
      const { data: newGroup, error: gErr } = await supabase
        .from('task_groups')
        .insert({ name: itemData.name, color: itemData.color, icon: itemData.icon || '', sort_order: itemData.sort_order || 0, user_id: userId })
        .select().single();
      if (gErr) return { error: gErr.message };
      if (itemData.tasks && itemData.tasks.length > 0) {
        await supabase.from('standalone_tasks').insert(
          itemData.tasks.map((t) => ({
            task_group_id: newGroup.id, title: t.title, done: t.done,
            deadline: t.deadline || null, sort_order: t.sort_order || 0, user_id: userId,
          }))
        );
      }
      await supabase.from('trash').delete().eq('id', trashItem.id);
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
      return { success: true };

    } else if (trashItem.item_type === 'standalone_task') {
      await supabase.from('standalone_tasks').insert({
        title: itemData.title, done: itemData.done, deadline: itemData.deadline || null,
        task_group_id: null, sort_order: itemData.sort_order || 0, user_id: userId,
      });
      await supabase.from('trash').delete().eq('id', trashItem.id);
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
      return { success: true };
    }

    await supabase.from('trash').delete().eq('id', trashItem.id);
    setTrash((prev) => prev.filter((t) => t.id !== trashItem.id));
    return { success: true };
  }, [trash, userId]);

  const trashGroup = useCallback(async (group) => {
    if (!userId) return null;
    const payload = {
      item_type: 'task_group',
      item_name: group.name,
      item_data: JSON.stringify({ ...group }),
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      user_id: userId,
    };
    await supabase.from('standalone_tasks').delete().eq('task_group_id', group.id);
    await supabase.from('task_groups').delete().eq('id', group.id);
    const { data } = await supabase.from('trash').insert(payload).select().single();
    if (data) setTrash((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const trashStandaloneTask = useCallback(async (task) => {
    if (!userId) return null;
    const payload = {
      item_type: 'standalone_task',
      item_name: task.title,
      item_data: JSON.stringify({ ...task }),
      deleted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      user_id: userId,
    };
    await supabase.from('standalone_tasks').delete().eq('id', task.id);
    const { data } = await supabase.from('trash').insert(payload).select().single();
    if (data) setTrash((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const deleteForever = useCallback(async (trashId) => {
    await supabase.from('trash').delete().eq('id', trashId);
    setTrash((prev) => prev.filter((t) => t.id !== trashId));
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        settingsLoading,
        saveSetting,
        refreshExchangeRate,
        convertAmount,
        formatMoney,
        trash,
        trashClient,
        trashTask,
        trashGroup,
        trashStandaloneTask,
        restoreFromTrash,
        deleteForever,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// Demo data — used when NEXT_PUBLIC_DEMO_MODE=true
// All dates are computed relative to the current day so they stay fresh.

import type { Client, TaskGroup, StandaloneTask, Settings } from '@/types'

const today = new Date()
const fmt = (d: Date): string => d.toISOString().split('T')[0]
const addDays = (n: number): string => {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

const todayStr     = fmt(today)
const tomorrowStr  = addDays(1)
const threeDaysAgo = addDays(-3)
const inTwoDays    = addDays(2)

const now          = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const ts           = now.toISOString()

// ── Clients ───────────────────────────────────────────────────────────────────

export const DEMO_CLIENTS: Client[] = [
  {
    id: 'demo-c1',
    name: 'Nova Studio',
    color: '#FDE8E8',
    logo: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    tax_id: '',
    task_mode: false,
    retainer: 500,
    retainer_currency: 'NGN',
    retainerPaid: { [currentMonth]: true },
    tasks: [
      { id: 'demo-t1',  title: 'Design landing page',    done: true,  paid: true,  amount: 350, currency: 'NGN', deadline: null,        sort_order: 0, createdAt: ts },
      { id: 'demo-t2',  title: 'Write copy for homepage', done: true,  paid: true,  amount: 150, currency: 'NGN', deadline: null,        sort_order: 1, createdAt: ts },
      { id: 'demo-t3',  title: 'Set up analytics',        done: false, paid: false, amount: 0,   currency: 'NGN', deadline: tomorrowStr, sort_order: 2, createdAt: ts },
      { id: 'demo-t4',  title: 'Review final designs',    done: false, paid: false, amount: 0,   currency: 'NGN', deadline: null,        sort_order: 3, createdAt: ts },
    ],
  },
  {
    id: 'demo-c2',
    name: 'Peak Agency',
    color: '#DBEAFE',
    logo: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    tax_id: '',
    task_mode: false,
    retainer: 0,
    retainer_currency: 'NGN',
    retainerPaid: {},
    tasks: [
      { id: 'demo-t5',  title: 'Create pitch deck',     done: true,  paid: true,  amount: 200, currency: 'NGN', deadline: null,        sort_order: 0, createdAt: ts },
      { id: 'demo-t6',  title: 'Prepare client report', done: false, paid: false, amount: 0,   currency: 'NGN', deadline: threeDaysAgo, sort_order: 1, createdAt: ts },
      { id: 'demo-t7',  title: 'Send invoice',          done: false, paid: false, amount: 80,  currency: 'NGN', deadline: null,        sort_order: 2, createdAt: ts },
    ],
  },
  {
    id: 'demo-c3',
    name: 'Bloom Co',
    color: '#D1FAE5',
    logo: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    tax_id: '',
    task_mode: false,
    retainer: 300,
    retainer_currency: 'NGN',
    retainerPaid: { [currentMonth]: false },
    tasks: [
      { id: 'demo-t8',  title: 'Brand identity design',  done: true,  paid: true,  amount: 600, currency: 'NGN', deadline: null, sort_order: 0, createdAt: ts },
      { id: 'demo-t9',  title: 'Social media templates', done: true,  paid: true,  amount: 250, currency: 'NGN', deadline: null, sort_order: 1, createdAt: ts },
      { id: 'demo-t10', title: 'Photography brief',      done: true,  paid: true,  amount: 180, currency: 'NGN', deadline: null, sort_order: 2, createdAt: ts },
      { id: 'demo-t11', title: 'Content calendar',       done: true,  paid: false, amount: 0,   currency: 'NGN', deadline: null, sort_order: 3, createdAt: ts },
      { id: 'demo-t12', title: 'Campaign review',        done: false, paid: false, amount: 0,   currency: 'NGN', deadline: null, sort_order: 4, createdAt: ts },
    ],
  },
]

// ── Task groups ───────────────────────────────────────────────────────────────

export const DEMO_GROUPS: TaskGroup[] = [
  {
    id: 'demo-g1',
    name: 'Personal Goals',
    icon: 'Star',
    color: '#EDE9FE',
    sort_order: 0,
    createdAt: ts,
    tasks: [
      { id: 'demo-gt1', title: 'Read two books this month', done: true,  deadline: null, sort_order: 0, createdAt: ts },
      { id: 'demo-gt2', title: 'Morning workout routine',   done: false, deadline: null, sort_order: 1, createdAt: ts },
      { id: 'demo-gt3', title: 'Learn a new skill',         done: false, deadline: null, sort_order: 2, createdAt: ts },
    ],
  },
  {
    id: 'demo-g2',
    name: 'Learning',
    icon: 'BookOpen',
    color: '#FEF3C7',
    sort_order: 1,
    createdAt: ts,
    tasks: [
      { id: 'demo-gt4', title: 'Complete design course', done: false, deadline: inTwoDays, sort_order: 0, createdAt: ts },
      { id: 'demo-gt5', title: 'Watch tutorial series',  done: false, deadline: null,      sort_order: 1, createdAt: ts },
    ],
  },
]

// ── Standalone tasks ──────────────────────────────────────────────────────────

export const DEMO_STANDALONE_TASKS: StandaloneTask[] = [
  { id: 'demo-st1', title: 'Plan weekly schedule',   done: true,  deadline: null,       sort_order: 0, createdAt: ts },
  { id: 'demo-st2', title: 'Organise desktop files', done: true,  deadline: null,       sort_order: 1, createdAt: ts },
  { id: 'demo-st3', title: 'Write journal entry',    done: false, deadline: todayStr,   sort_order: 2, createdAt: ts },
  { id: 'demo-st4', title: 'Reply to emails',        done: false, deadline: tomorrowStr, sort_order: 3, createdAt: ts },
]

// ── Settings ──────────────────────────────────────────────────────────────────
// Note: custom_font and custom_heading_font use empty strings here.
// The original demoData.js carries large base64 font blobs; this typed version
// relies on the CSS @font-face declarations in globals.css for NoirPro fonts.

export const DEMO_SETTINGS: Settings = {
  username: 'Alex',
  company_name: 'Demo Workspace',
  logo: '',
  dashboard_heading: 'Track your\nwork & earnings',
  dashboard_subtitle: '',
  accent_color: '#ED64A6',
  card_size: 'medium',
  currency: 'NGN',
  exchange_rate: 1,
  exchange_rates: '',
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
  changelog: JSON.stringify([
    {
      version: '1.7.3',
      date: '16 Apr, 2026',
      features: ['Demo mode with realistic sample data'],
      improvements: ['Full mobile responsive layout', 'Bottom sheet modals on mobile'],
      fixes: [],
    },
  ]),
  whats_new_active: 'false',
  whats_new_version: '',
  onboarding_complete: 'true',
  fey_onboarding_complete: 'true',
  avatar_url: '',
  hourly_rate: '',
  cover_image: '',
  invoice_layout: 'classic',
  invoice_font_color: '',
  invoice_bg_color: '',
  invoice_bg_image: '',
  page_bg_type: 'color',
  page_bg_color: '',
  page_bg_image: '',
  color_mode: 'light',
  business_email: '',
  business_phone: '',
  business_website: '',
  business_address: '',
  tax_id: '',
  payment_templates: '',
  show_payment_on_docs: 'false',
  invoice_language: 'en',
  default_tax_rate: '0',
  invoice_prefix: 'INV-',
  invoice_next: '1',
  quote_prefix: 'QUO-',
  quote_next: '1',
  receipt_prefix: 'REC-',
  receipt_next: '1',
  include_date_in_number: 'false',
  payment_terms_days: '14',
  quote_valid_days: '30',
  date_format: 'MMM D, YYYY',
  default_invoice_notes: '',
  auto_generate_receipt: 'false',
  revoke_link_on_payment: 'false',
  email_acceptance: 'true',
  email_payment_received: 'true',
  email_stripe: 'true',
  email_project_activity: 'true',
  email_chat_from: 'true',
  email_chat_to: 'true',
  email_auto_reminders: 'true',
  checklist_dismissed: 'false',
  checklist_steps: '',
  guide_seen: 'false',
  fey_thread_order: '',
  fey_sort_mode: 'newest',
}

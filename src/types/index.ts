export interface Task {
  id: string
  title: string
  done: boolean
  paid: boolean
  amount: number
  currency: string
  deadline: string | null
  sort_order: number
  createdAt: string
  _isCampaignTask?: boolean
}

export interface Client {
  id: string
  name: string
  color: string
  logo: string
  email: string
  phone: string
  address: string
  website: string
  tax_id: string
  task_mode: boolean
  retainer: number
  retainer_currency: string
  retainerPaid: Record<string, boolean>
  tasks: Task[]
  allTasks?: Task[]
}

export interface TaskGroup {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
  createdAt: string
  tasks: StandaloneTask[]
}

export interface StandaloneTask {
  id: string
  title: string
  done: boolean
  deadline: string | null
  sort_order: number
  createdAt: string
}

export interface Campaign {
  id: string
  client_id: string
  name: string
  color: string
  logo?: string
  budget: number
  budget_currency: string
  start_date: string | null
  end_date: string | null
  status: string
  notes: string
  sort_order: number
  created_at: string
  tasks?: Task[]
}

export interface Invoice {
  id: string
  user_id: string
  app: string
  client_id: string | null
  crm_contact_id: string | null

  // Document identity
  invoice_number: string
  status: string                   // draft | sent | viewed | paid | overdue | void
  issue_date: string               // YYYY-MM-DD
  due_date: string | null
  supply_date: string | null

  // People — JSONB, cast to specific shapes in each page
  from_details: unknown
  bill_to: unknown

  // Content — JSONB
  line_items: unknown
  task_ids: unknown
  custom_sections: unknown
  payment_details: unknown
  totals: unknown
  notes: string
  attachments: unknown

  // Presentation
  currency: string
  layout: string
  font_color: string
  bg_color: string
  font_family: string
  invoice_settings: unknown

  // Sharing
  share_token: string | null
  share_enabled: boolean

  created_at: string
  updated_at: string
}

export interface FeyThread {
  id: string
  user_id: string
  message_date: string
  heading: string
  created_at: string
}


export interface Settings {
  username: string
  company_name: string
  logo: string
  dashboard_heading: string
  dashboard_subtitle: string
  accent_color: string
  card_size: string
  currency: string
  exchange_rate: number
  exchange_rates: string
  exchange_rate_updated_at: string
  font_family: string
  custom_font: string
  custom_font_name: string
  heading_font: string
  custom_heading_font: string
  custom_heading_font_name: string
  client_order: string
  clients_label: string
  app_mode: string
  changelog: string
  whats_new_active: string
  whats_new_version: string
  onboarding_complete: string
  /** Fey-specific onboarding flag — separate from onboarding_complete (used by Workboard) */
  fey_onboarding_complete: string
  /** Set during /setup — the surest signal that Fey onboarding is done */
  workspace_slug: string
  avatar_url: string
  hourly_rate: string
  cover_image: string
  invoice_layout: string
  invoice_font_color: string
  invoice_bg_color: string
  invoice_bg_image: string
  page_bg_type: string
  page_bg_color: string
  page_bg_image: string
  color_mode: string
  business_email: string
  business_phone: string
  business_website: string
  business_address: string
  tax_id: string
  payment_templates: string
  show_payment_on_docs: string
  invoice_language: string
  default_tax_rate: string
  invoice_prefix: string
  invoice_next: string
  quote_prefix: string
  quote_next: string
  receipt_prefix: string
  receipt_next: string
  include_date_in_number: string
  payment_terms_days: string
  quote_valid_days: string
  date_format: string
  default_invoice_notes: string
  auto_generate_receipt: string
  revoke_link_on_payment: string
  email_acceptance: string
  email_payment_received: string
  email_stripe: string
  email_project_activity: string
  email_chat_from: string
  email_chat_to: string
  /** When 'true', portal clients can see read receipts on their sent messages. Owners always see client reads. */
  portal_read_receipts: string
  /** Days to keep messages before the retention cron deletes them. Default 60. */
  message_retention_days: string
  /** When 'true' (default), the daily task-digest cron emails this user. */
  task_digest_enabled: string
  email_auto_reminders: string
  checklist_dismissed: string
  checklist_steps: string
  guide_seen: string
  fey_thread_order: string
  fey_sort_mode: string
}

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface ToastOptions {
  description?: string
  position?: ToastPosition
  action?: { label: string; onClick: () => void }
}

export interface Toast {
  id: number
  message: string
  description?: string | undefined
  position: ToastPosition
  action?: { label: string; onClick: () => void } | undefined
}

export interface TrashItem {
  id: string
  item_type: string
  item_name: string
  item_data: string
  deleted_at: string
  expires_at: string
  user_id: string
}

export interface ClientActions {
  addClient: (name: string, color: string, logo?: string) => Promise<void>
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>
  deleteClient: (clientId: string) => Promise<void>
  updateRetainer: (clientId: string, retainer: number, currency?: string) => Promise<void>
  toggleRetainerPaid: (clientId: string, month: string, paid: boolean) => Promise<void>
  addTask: (clientId: string, title: string, currency?: string) => Promise<void>
  updateTask: (clientId: string, taskId: string, updates: Partial<Task>) => Promise<void>
  reorderTasks: (clientId: string, orderedIds: string[]) => Promise<void>
  deleteTask: (clientId: string, taskId: string) => Promise<void>
  refetch: () => Promise<void>
  saveClientOrder: (ids: string[]) => Promise<void>
}

export interface ClientFile {
  id: string
  client_id: string
  campaign_id: string | null
  uploaded_by: string | null
  uploader_name: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number
  file_type: string
  version: number
  status: 'pending' | 'approved' | 'declined' | 'amended'
  amendment_notes: string | null
  parent_file_id: string | null
  created_at: string
  _source: 'client' | 'task'
}

export interface FeyTask {
  id: string
  thread_id: string
  user_id: string
  title: string
  done: boolean
  deadline: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface FeyThreadWithTasks extends FeyThread {
  tasks: FeyTask[]
}

export interface TaskFile {
  id: string
  task_id: string
  client_id: string | null
  uploaded_by: string | null
  uploader_name: string
  file_name: string
  file_url: string
  public_id: string
  file_size: number
  file_type: string
  version: number
  status: 'pending' | 'approved' | 'declined' | 'amended'
  amendment_notes: string | null
  parent_file_id: string | null
  created_at: string
}

export interface RestoreResult {
  success?: boolean
  error?: string
  autoRestoredClient?: boolean
  clientName?: string
  createdPlaceholder?: boolean
}

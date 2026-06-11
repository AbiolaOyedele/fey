-- invoices: stores all invoice, quote, and receipt documents.
-- Each row is one document created by a user in the invoice builder.
-- JSON columns (from_details, bill_to, line_items, etc.) store rich structured data
-- that changes frequently — easier to evolve as JSONB than as many nullable columns.

create table if not exists public.invoices (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  app              text        not null default 'fey',
  client_id        uuid        references public.clients(id) on delete set null,

  -- Document identity
  invoice_number   text        not null default '',
  status           text        not null default 'draft',   -- draft | sent | viewed | paid | overdue | void
  issue_date       text        not null default '',        -- stored as YYYY-MM-DD string
  due_date         text,
  supply_date      text,

  -- People
  from_details     jsonb       not null default '{}',
  bill_to          jsonb       not null default '{}',

  -- Content
  line_items       jsonb       not null default '[]',
  task_ids         jsonb       not null default '[]',
  custom_sections  jsonb       not null default '[]',
  payment_details  jsonb       not null default '{}',
  totals           jsonb       not null default '{}',
  notes            text        not null default '',
  attachments      jsonb       not null default '[]',

  -- Presentation
  currency         text        not null default 'NGN',
  layout           text        not null default 'classic',
  font_color       text        not null default '',
  bg_color         text        not null default '',
  font_family      text        not null default '',
  invoice_settings jsonb       not null default '{}',

  -- Sharing
  share_token      text        unique,
  share_enabled    boolean     not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.invoices enable row level security;

create policy "invoices_select_own"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "invoices_insert_own"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "invoices_update_own"
  on public.invoices for update
  using (auth.uid() = user_id);

create policy "invoices_delete_own"
  on public.invoices for delete
  using (auth.uid() = user_id);

-- Public invoice access via share token (no auth required)
create policy "invoices_select_public_share"
  on public.invoices for select
  using (share_enabled = true and share_token is not null);

-- Index for the user's invoice list (most common query)
create index if not exists idx_invoices_user_app
  on public.invoices(user_id, app, created_at desc);

-- Index for share-token lookups from the public invoice page
create index if not exists idx_invoices_share_token
  on public.invoices(share_token)
  where share_token is not null;

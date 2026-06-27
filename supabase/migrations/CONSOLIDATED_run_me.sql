-- ============================================================================
-- Fey — consolidated migration (idempotent; safe to re-run any number of times)
-- Covers: recycle bin columns + the public-share security hardening (F3/F4/F5).
-- ============================================================================

-- ── 1. Recycle bin: soft-delete columns ─────────────────────────────────────
alter table projects     add column if not exists deleted_at timestamptz;
alter table crm_contacts add column if not exists deleted_at timestamptz;

create index if not exists projects_not_deleted_idx
  on projects (workspace_id) where deleted_at is null;
create index if not exists crm_contacts_not_deleted_idx
  on crm_contacts (owner_id) where deleted_at is null;

-- ── 2. Token-bound public-read RPCs (F3/F4/F5) ───────────────────────────────
create or replace function public.get_shared_invoice(p_token text)
returns setof public.invoices language sql security definer set search_path = public stable as $$
  select * from public.invoices where share_token = p_token and share_enabled = true limit 1;
$$;
revoke all on function public.get_shared_invoice(text) from public;
grant execute on function public.get_shared_invoice(text) to anon, authenticated;

create or replace function public.get_payment_request(p_token text)
returns setof public.crm_payment_requests language sql security definer set search_path = public stable as $$
  select * from public.crm_payment_requests where share_token = p_token limit 1;
$$;
revoke all on function public.get_payment_request(text) from public;
grant execute on function public.get_payment_request(text) to anon, authenticated;

create or replace function public.get_shared_client(p_token text)
returns setof public.shared_clients language sql security definer set search_path = public stable as $$
  select * from public.shared_clients where token = p_token limit 1;
$$;
revoke all on function public.get_shared_client(text) from public;
grant execute on function public.get_shared_client(text) to anon, authenticated;

-- (F5 file RPC omitted — the file table is crm_files, and F5 isn't converted
--  yet. It'll be added in the dedicated F5 pass.)

-- ── 3. Drop the leaky F3/F4 anon policies ────────────────────────────────────
-- SAFE NOW: the invoice page + pay page already read via the RPCs above in prod.
-- This is the step that actually closes F3 (invoice PII/totals) and F4 (pending
-- requests + pay tokens) — anon can no longer bulk-read these tables.
drop policy if exists "invoices_select_public_share"   on public.invoices;
drop policy if exists "crm_payment_requests_anon_read" on public.crm_payment_requests;

-- ── 4. F5 — NOT YET (left commented on purpose) ──────────────────────────────
-- The /share page's file/campaign/task reads are not all RPC-gated yet, so
-- dropping these would break it. Do NOT uncomment until that conversion ships.
-- (Note: file table here is crm_files; the run-1 audit named client_files.)
-- drop policy if exists "shared_client_members_insert_public" on public.shared_client_members;

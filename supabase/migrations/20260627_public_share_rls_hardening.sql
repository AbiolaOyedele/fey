-- Security hardening: bind public ("share link") reads to the exact secret
-- token via SECURITY DEFINER RPCs, and remove the over-permissive anon policies
-- that gate on a boolean/status flag (which let anyone with the public anon key
-- bulk-read across tenants without knowing any link).
--
-- ⚠️ COORDINATED DEPLOY: the app must be reading via these RPCs BEFORE the old
-- policies are dropped, or the public invoice / pay / share pages break. Run the
-- "create function" section first, deploy the app changes, then run the "drop
-- policy" section. (Both are in this file; split the run if deploying gradually.)

-- ── F3: invoices ──────────────────────────────────────────────────────────────
create or replace function public.get_shared_invoice(p_token text)
returns setof public.invoices
language sql
security definer
set search_path = public
stable
as $$
  select * from public.invoices
  where share_token = p_token
    and share_enabled = true
  limit 1;
$$;
revoke all on function public.get_shared_invoice(text) from public;
grant execute on function public.get_shared_invoice(text) to anon, authenticated;

-- ── F4: crm_payment_requests ──────────────────────────────────────────────────
create or replace function public.get_payment_request(p_token text)
returns setof public.crm_payment_requests
language sql
security definer
set search_path = public
stable
as $$
  select * from public.crm_payment_requests
  where share_token = p_token
  limit 1;
$$;
revoke all on function public.get_payment_request(text) from public;
grant execute on function public.get_payment_request(text) to anon, authenticated;

-- ── F5: shared_clients + its files/campaigns ──────────────────────────────────
-- Return the shared-client record only when the exact token is presented.
create or replace function public.get_shared_client(p_token text)
returns setof public.shared_clients
language sql
security definer
set search_path = public
stable
as $$
  select * from public.shared_clients
  where token = p_token
  limit 1;
$$;
revoke all on function public.get_shared_client(text) from public;
grant execute on function public.get_shared_client(text) to anon, authenticated;

-- Files for a shared client, gated on the share token (not "any shared client").
create or replace function public.get_shared_client_files(p_token text)
returns setof public.client_files
language sql
security definer
set search_path = public
stable
as $$
  select cf.* from public.client_files cf
  join public.shared_clients sc on sc.client_id = cf.client_id
  where sc.token = p_token;
$$;
revoke all on function public.get_shared_client_files(text) from public;
grant execute on function public.get_shared_client_files(text) to anon, authenticated;

-- =============================================================================
-- DROP the permissive anon policies. Run ONLY after the app deploy that switches
-- the matching pages to the RPCs above.
-- =============================================================================

-- F3 + F4 — READY now (the invoice page + pay page already read via RPC):
-- drop policy if exists "invoices_select_public_share"   on public.invoices;
-- drop policy if exists "crm_payment_requests_anon_read" on public.crm_payment_requests;

-- F5 — NOT YET. The /share/[token] page's entry read uses get_shared_client, but
-- its dependent reads (client_files, task_files, client_campaigns, campaign_tasks,
-- tasks — all by client_id) still read those tables directly and rely on their
-- public policies. Dropping the policies below before those reads are converted
-- to token-bound RPCs would break the share page. Convert them first, then drop:
-- drop policy if exists "Public can view files for shared clients"        on public.task_files;
-- drop policy if exists "Public can view client_files for shared clients" on public.client_files;
-- drop policy if exists "shared_client_members_insert_public"             on public.shared_client_members;
-- (Re-create any genuinely-needed public read as a SECURITY DEFINER RPC bound to
--  the token, never as a table policy gated on a flag.)

-- App isolation: allow Fey and WorkBoard to share the same Supabase project
-- without data bleeding between apps for users who use both.
--
-- Every shared table gets an `app` column. Existing rows default to 'workboard'.
-- Fey writes 'fey', WorkBoard writes 'workboard'. Queries in each app filter
-- by their own app value so users see only their own app's data.
--
-- File tables (task_files, client_files) are excluded — they are already
-- app-isolated transitively via their FK to tasks/clients.

alter table public.clients             add column if not exists app text not null default 'workboard';
alter table public.tasks               add column if not exists app text not null default 'workboard';
alter table public.retainer_payments   add column if not exists app text not null default 'workboard';
alter table public.campaign_tasks      add column if not exists app text not null default 'workboard';
alter table public.task_groups         add column if not exists app text not null default 'workboard';
alter table public.standalone_tasks    add column if not exists app text not null default 'workboard';
alter table public.invoices            add column if not exists app text not null default 'workboard';
alter table public.client_campaigns    add column if not exists app text not null default 'workboard';
alter table public.user_linked_clients add column if not exists app text not null default 'workboard';

-- Indexes to keep app-scoped queries fast
create index if not exists idx_clients_app             on public.clients(user_id, app);
create index if not exists idx_tasks_app               on public.tasks(user_id, app);
create index if not exists idx_task_groups_app         on public.task_groups(user_id, app);
create index if not exists idx_standalone_tasks_app    on public.standalone_tasks(user_id, app);
create index if not exists idx_invoices_app            on public.invoices(user_id, app);
create index if not exists idx_client_campaigns_app    on public.client_campaigns(user_id, app);
create index if not exists idx_campaign_tasks_app      on public.campaign_tasks(user_id, app);
create index if not exists idx_retainer_payments_app   on public.retainer_payments(user_id, app);
create index if not exists idx_user_linked_clients_app on public.user_linked_clients(user_id, app);

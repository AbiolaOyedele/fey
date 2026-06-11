-- app_settings: key-value store for per-user preferences and configuration.
-- Each setting is one row: (user_id, key, value). The Settings interface in
-- src/types/index.ts documents every valid key. Values are always stored as
-- text and coerced in application code.

create table if not exists public.app_settings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  key        text        not null,
  value      text        not null default '',
  created_at timestamptz not null default now(),

  unique (user_id, key)
);

alter table public.app_settings enable row level security;

create policy "app_settings_select_own"
  on public.app_settings for select
  using (auth.uid() = user_id);

create policy "app_settings_insert_own"
  on public.app_settings for insert
  with check (auth.uid() = user_id);

create policy "app_settings_update_own"
  on public.app_settings for update
  using (auth.uid() = user_id);

create policy "app_settings_delete_own"
  on public.app_settings for delete
  using (auth.uid() = user_id);

create index if not exists idx_app_settings_user
  on public.app_settings(user_id);

-- ─────────────────────────────────────────────────────────────────────────────

-- trash: soft-delete store for clients, tasks, task groups, and standalone tasks.
-- Items expire after a configurable TTL (enforced in application code).
-- item_data holds the full serialised JSON snapshot of the deleted item so it
-- can be restored without touching any other table first.

create table if not exists public.trash (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  item_type   text        not null,                -- client | task | task_group | standalone_task
  item_name   text        not null,
  item_data   jsonb       not null default '{}',
  deleted_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.trash enable row level security;

create policy "trash_select_own"
  on public.trash for select
  using (auth.uid() = user_id);

create policy "trash_insert_own"
  on public.trash for insert
  with check (auth.uid() = user_id);

create policy "trash_delete_own"
  on public.trash for delete
  using (auth.uid() = user_id);

create index if not exists idx_trash_user
  on public.trash(user_id, deleted_at desc);

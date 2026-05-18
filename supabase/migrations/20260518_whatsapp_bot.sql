-- whatsapp_connections
-- Stores one verified (or pending) phone number per user.
create table if not exists public.whatsapp_connections (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  phone_number  text        not null,
  verified      boolean     not null default false,
  connected_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique(user_id)
);

alter table public.whatsapp_connections enable row level security;

-- Users can read their own connection record (to show status in Settings)
create policy "Users can read own whatsapp connection"
  on public.whatsapp_connections for select
  using (auth.uid() = user_id);

-- Users can delete their own connection record (disconnect from Settings)
create policy "Users can delete own whatsapp connection"
  on public.whatsapp_connections for delete
  using (auth.uid() = user_id);

-- All writes (insert/update) go through the bot server using the service role key.
-- No user-facing insert/update policies are needed.


-- verification_codes
-- Stores short-lived 6-digit codes for WhatsApp phone verification.
-- Accessed exclusively by the bot server via the service role key — no user policies.
create table if not exists public.verification_codes (
  id           uuid        primary key default gen_random_uuid(),
  phone_number text        not null,
  code         text        not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.verification_codes enable row level security;
-- No user-facing policies — service role key bypasses RLS.

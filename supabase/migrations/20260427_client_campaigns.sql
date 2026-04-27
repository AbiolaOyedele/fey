-- Client Campaigns — grouped tasks inside a client workspace
-- Run this in your Supabase SQL editor

create table if not exists client_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  color text default '#818cf8',
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists campaign_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references client_campaigns on delete cascade,
  client_id uuid references clients on delete cascade,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  done boolean default false,
  paid boolean default false,
  amount numeric default 0,
  currency text default 'NGN',
  deadline date,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RLS
alter table client_campaigns enable row level security;
alter table campaign_tasks enable row level security;

create policy "Users manage their client campaigns" on client_campaigns
  for all using (user_id = auth.uid());

create policy "Users manage their campaign tasks" on campaign_tasks
  for all using (user_id = auth.uid());

-- Public read for shared client pages
create policy "Public can view campaigns for shared clients" on client_campaigns
  for select using (
    client_id in (select client_id from shared_clients where active = true)
  );

create policy "Public can view campaign tasks for shared clients" on campaign_tasks
  for select using (
    client_id in (select client_id from shared_clients where active = true)
  );

-- Realtime
alter publication supabase_realtime add table client_campaigns;
alter publication supabase_realtime add table campaign_tasks;

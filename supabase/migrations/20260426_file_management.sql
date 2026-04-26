-- File Management Tables
-- Run this in your Supabase SQL editor

create table if not exists task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade,
  client_id uuid references clients on delete cascade,
  uploaded_by uuid references auth.users on delete set null,
  uploader_name text,
  file_name text not null,
  file_url text not null,
  public_id text not null,
  file_size integer,
  file_type text,
  version integer default 1,
  parent_file_id uuid references task_files on delete set null,
  status text default 'pending' check (status in ('pending','approved','declined','amended')),
  amendment_notes text,
  created_at timestamptz default now()
);

create table if not exists client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  uploaded_by uuid references auth.users on delete set null,
  uploader_name text,
  file_name text not null,
  file_url text not null,
  public_id text not null,
  file_size integer,
  file_type text,
  version integer default 1,
  parent_file_id uuid references client_files on delete set null,
  status text default 'pending' check (status in ('pending','approved','declined','amended')),
  amendment_notes text,
  created_at timestamptz default now()
);

-- RLS
alter table task_files enable row level security;
alter table client_files enable row level security;

-- Allow authenticated users to CRUD their own files (via client ownership)
create policy "Users manage task_files for their clients" on task_files
  for all using (
    client_id in (select id from clients where user_id = auth.uid())
    or uploaded_by = auth.uid()
  );

create policy "Users manage client_files for their clients" on client_files
  for all using (
    client_id in (select id from clients where user_id = auth.uid())
    or uploaded_by = auth.uid()
  );

-- Enable Realtime
alter publication supabase_realtime add table task_files;
alter publication supabase_realtime add table client_files;

-- Recycle Bin: soft-delete support.
-- work_tasks already has deleted_at (and the repo already soft-deletes tasks);
-- this adds the same column to projects and crm_contacts so deletes there go to
-- the bin instead of being destroyed. Additive + nullable — safe to run anytime.

alter table projects     add column if not exists deleted_at timestamptz;
alter table crm_contacts add column if not exists deleted_at timestamptz;

-- Partial indexes so the common "not deleted" reads stay fast.
create index if not exists projects_not_deleted_idx
  on projects (workspace_id) where deleted_at is null;
create index if not exists crm_contacts_not_deleted_idx
  on crm_contacts (owner_id) where deleted_at is null;

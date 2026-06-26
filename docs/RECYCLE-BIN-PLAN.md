# Recycle Bin — Design & Migration Plan

Status: **planned, not built.** This is the spec for a follow-up session. Reviewed approach: soft-delete with a central recovery page.

## Goal

When a user deletes a project, task, or client, it goes to a **Recycle Bin**
instead of being destroyed. From there they can **Restore** it or **Delete
forever**. Items auto-purge after **30 days**.

## Approach: per-table soft delete (`deleted_at`)

We use a `deleted_at timestamptz` column on each table (the same proven shape as
`projects.archived_at`), **not** the existing serialize-into-`trash`-table
approach. Why:

- **Restore is lossless.** The row keeps its original ID, so all its children and
  relations (a project's messages/files, a task's subtasks, a client's
  everything) come back intact automatically. Serialize-and-reinsert would
  regenerate IDs and break every foreign-key reference.
- **No fragile JSON (de)serialization.** Restore is just `SET deleted_at = NULL`.
- **RLS already covers it.** Ownership policies gate the rows; we only add a
  `deleted_at IS NULL` filter at the query level — no policy changes.

`archived_at` (projects) stays a separate concept: *archive* = intentional hide,
*delete* = goes to the bin. They don't collide.

## Scope

**v1 (this plan):** projects, tasks (`work_tasks`), clients (`contacts`).
**Later:** files, invoices, contracts (same pattern, additive).

## 1. SQL migration (you run this in Supabase SQL editor)

Safe to run anytime — additive, nullable columns, no data change. Save as
`supabase/migrations/20260627_soft_delete.sql`.

```sql
-- Soft-delete columns for the Recycle Bin.
alter table projects   add column if not exists deleted_at timestamptz;
alter table work_tasks add column if not exists deleted_at timestamptz;
alter table contacts   add column if not exists deleted_at timestamptz;

-- Partial indexes so "not deleted" reads (the common path) stay fast.
create index if not exists projects_not_deleted_idx   on projects   (workspace_id) where deleted_at is null;
create index if not exists work_tasks_not_deleted_idx on work_tasks (workspace_id) where deleted_at is null;
create index if not exists contacts_not_deleted_idx   on contacts   (owner_id)     where deleted_at is null;
```

(Column names assume `work_tasks` and `contacts` carry `workspace_id`/`owner_id`
— confirm against the live schema before running.)

## 2. App changes (next session)

1. **Reads filter out deleted rows.** Add `.is('deleted_at', null)` to every
   list/read query in `repositories/` + the hooks (`useProjects`, `useTasks`,
   `useCrm`/contacts). Audit each consumer so nothing leaks deleted rows.
2. **Deletes become soft deletes.** The current hard `.delete()` calls become
   `.update({ deleted_at: now })`. The confirm dialog (already shipped) stays,
   but copy changes from "can't be undone" → "moves to Recycle Bin".
3. **Recycle Bin page** at `/trash`:
   - Lists deleted projects, tasks, and clients (grouped by type, newest first,
     with "deleted N days ago" + "purges in M days").
   - **Restore** (`deleted_at = null`) and **Delete forever** (hard `.delete()`,
     itself confirmed). Optional "Empty bin".
   - Add a "Recycle Bin" entry to the sidebar (desktop) and the mobile "More".
4. **Auto-purge** — a Vercel Cron hitting `/api/v1/cron/purge-trash` daily that
   hard-deletes rows where `deleted_at < now() - interval '30 days'`. Guard the
   route with a `CRON_SECRET`. Add the schedule to `vercel.ts`/`vercel.json`.

## 3. Things to verify when building

- Every place that reads projects/tasks/contacts is updated (grep for
  `.from('projects'`, `.from('work_tasks'`, `.from('contacts'`).
- Portal/client-facing queries also exclude deleted rows.
- Deleting a parent (client) — decide whether its child projects/tasks are
  cascaded into the bin or left; v1 can leave children and rely on the parent
  filter, but document it.
- Counts/badges (dashboard KPIs) exclude deleted rows.

## Estimated effort

~Half a day: migration (5 min, you run it) + read-path audit + soft-delete
swap + the `/trash` page + cron purge. The confirm dialog and the
archived-projects recovery (already shipped) are the foundation this builds on.

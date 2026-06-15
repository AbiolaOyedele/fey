-- ════════════════════════════════════════════════════════════════════════════
-- Workspace scoping for CRM data
-- Date: 2026-06-14
--
-- CRM data was keyed only on owner_id (the user). When one user owns multiple
-- workspaces, every workspace resolved to the same owner_id and therefore showed
-- the SAME data. This adds a workspace_id to each CRM table so data belongs to a
-- specific workspace, not just a user.
--
-- Backfill: existing rows go to the owner's PRIMARY (earliest) workspace.
-- workspace_id is ON DELETE CASCADE, so deleting a workspace also removes that
-- workspace's CRM data (its clients, messages, files, contracts, forms, etc.).
-- ════════════════════════════════════════════════════════════════════════════

-- owner_id-keyed tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_contacts','crm_messages','crm_files','crm_contracts','crm_forms','crm_payment_requests'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format($q$
      UPDATE %1$I x
      SET workspace_id = (
        SELECT w.id FROM workspaces w
        WHERE w.owner_id = x.owner_id
        ORDER BY w.created_at ASC LIMIT 1
      )
      WHERE x.workspace_id IS NULL
    $q$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON %I (workspace_id)', t, t);
  END LOOP;
END $$;

-- user_id-keyed tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','crm_templates'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format($q$
      UPDATE %1$I x
      SET workspace_id = (
        SELECT w.id FROM workspaces w
        WHERE w.owner_id = x.user_id
        ORDER BY w.created_at ASC LIMIT 1
      )
      WHERE x.workspace_id IS NULL
    $q$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON %I (workspace_id)', t, t);
  END LOOP;
END $$;

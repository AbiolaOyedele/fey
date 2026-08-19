-- ════════════════════════════════════════════════════════════════════════════
-- One board per owner
--
-- The client portal was showing a different set of stages to the one the agency
-- works from, and tasks a client raised were landing in columns that do not
-- exist on the agency's board. This is why.
--
-- The original constraint was:
--
--     UNIQUE (workspace_id) WHERE is_default
--
-- In Postgres a unique index does not treat two NULLs as equal, so a default
-- workflow with workspace_id = NULL and a default workflow with a real
-- workspace_id both satisfy it. Every owner could therefore hold two "default"
-- boards at once, and did.
--
-- The two sides then disagreed about which one was real:
--   • the app lists every workflow for the owner and takes the oldest default
--   • the portal looked up the default for the owner's workspace exactly
--
-- Different rows, different stage names, same account. A task filed by a client
-- into the portal's "Backlog" got a stage_id belonging to the board the agency
-- never opens — so it appeared on nobody's board and was counted in nobody's
-- columns.
--
-- This migration keeps the board the app renders (the owner's oldest default),
-- moves any task stranded on a duplicate onto it, retires the duplicate, and
-- replaces the constraint with one that actually holds.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Move stranded tasks onto the surviving board ─────────────────────────
-- Matched by stage name first, so a duplicate that happens to carry the same
-- columns keeps each task where it was. Only a name with no counterpart falls
-- back to the first column — visible and triageable beats accurate and lost.
WITH keeper AS (
  SELECT DISTINCT ON (owner_id) owner_id, id
  FROM workflows
  WHERE is_default = true AND deleted_at IS NULL
  ORDER BY owner_id, created_at, id
),
dupe AS (
  SELECT w.id, k.id AS keeper_id
  FROM workflows w
  JOIN keeper k ON k.owner_id = w.owner_id
  WHERE w.is_default = true AND w.deleted_at IS NULL AND w.id <> k.id
),
keeper_first AS (
  SELECT DISTINCT ON (workflow_id) workflow_id, id
  FROM workflow_stages
  ORDER BY workflow_id, sort_order, created_at, id
),
remap AS (
  SELECT s.id AS from_id, COALESCE(m.id, kf.id) AS to_id
  FROM dupe d
  JOIN workflow_stages s ON s.workflow_id = d.id
  LEFT JOIN LATERAL (
    SELECT ks.id FROM workflow_stages ks
    WHERE ks.workflow_id = d.keeper_id AND lower(ks.name) = lower(s.name)
    ORDER BY ks.sort_order LIMIT 1
  ) m ON true
  LEFT JOIN keeper_first kf ON kf.workflow_id = d.keeper_id
)
UPDATE work_tasks t
SET stage_id = r.to_id
FROM remap r
WHERE t.stage_id = r.from_id
  AND r.to_id IS NOT NULL;

-- ── 2. Point any project pinned to a duplicate at the survivor ──────────────
WITH keeper AS (
  SELECT DISTINCT ON (owner_id) owner_id, id
  FROM workflows
  WHERE is_default = true AND deleted_at IS NULL
  ORDER BY owner_id, created_at, id
),
dupe AS (
  SELECT w.id, k.id AS keeper_id
  FROM workflows w
  JOIN keeper k ON k.owner_id = w.owner_id
  WHERE w.is_default = true AND w.deleted_at IS NULL AND w.id <> k.id
)
UPDATE projects p
SET workflow_id = d.keeper_id
FROM dupe d
WHERE p.workflow_id = d.id;

-- ── 3. Retire the duplicates ────────────────────────────────────────────────
-- Soft-deleted, not dropped. Their stage rows stay behind so the handoff trail
-- can still name the column a task passed through before this ran; dropping the
-- workflow would cascade those away and blank out the history.
WITH keeper AS (
  SELECT DISTINCT ON (owner_id) owner_id, id
  FROM workflows
  WHERE is_default = true AND deleted_at IS NULL
  ORDER BY owner_id, created_at, id
)
UPDATE workflows w
SET deleted_at = now(), updated_at = now()
FROM keeper k
WHERE k.owner_id = w.owner_id
  AND w.is_default = true
  AND w.deleted_at IS NULL
  AND w.id <> k.id;

-- ── 4. "Backlog" becomes "Assigned" on untouched stock boards ───────────────
-- A client raising a task is handing the agency work, not adding to a wishlist,
-- so the first column reads Assigned. Applied only where all four seeded names
-- are still exactly as seeded — anyone who has renamed or reordered their board
-- has expressed a preference, and it is left alone.
UPDATE workflow_stages s
SET name = 'Assigned'
WHERE lower(s.name) = 'backlog'
  AND EXISTS (
    SELECT 1 FROM workflows w
    WHERE w.id = s.workflow_id AND w.is_default = true AND w.deleted_at IS NULL
  )
  AND (
    SELECT array_agg(lower(x.name) ORDER BY x.sort_order)
    FROM workflow_stages x WHERE x.workflow_id = s.workflow_id
  ) = ARRAY['backlog', 'in progress', 'review', 'done'];

-- ── 5. A constraint that holds ──────────────────────────────────────────────
-- Per owner, not per workspace. The app has only ever been able to render one
-- board, and this is the rule it was already assuming.
DROP INDEX IF EXISTS idx_one_default_workflow_per_workspace;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_workflow_per_owner
  ON workflows (owner_id)
  WHERE is_default = true AND deleted_at IS NULL;

COMMIT;

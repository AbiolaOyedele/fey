-- Adds the `super_admin` workspace role.
--
-- RUN THIS FILE FIRST, ON ITS OWN, AND LET IT COMMIT before running
-- 20260802_workspace_admin_permissions.sql. Postgres refuses to *use* a new
-- enum value in the same transaction that adds it ("unsafe use of new value of
-- enum type"), and the second migration both reads and writes 'super_admin'.
--
-- Idempotent: re-running is a no-op.

ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'super_admin';

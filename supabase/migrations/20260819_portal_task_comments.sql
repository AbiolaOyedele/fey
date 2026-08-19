-- ════════════════════════════════════════════════════════════════════════════
-- Clients can comment on tasks
--
-- task_comments.author_id is NOT NULL and references auth.users. Portal clients
-- aren't auth users — they're rows in portal_users — so there was no way to
-- record one as the author of a comment, and the portal's task drawer simply
-- hid the thread. A client could see the work and say nothing about it.
--
-- Rather than a parallel table, the same thread takes both kinds of author: the
-- conversation about a piece of work is one conversation, and splitting it in
-- storage would mean merging it back on every read and getting the ordering
-- right by hand.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Exactly one author, of one kind or the other.
ALTER TABLE task_comments ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS portal_author_id UUID REFERENCES portal_users(id) ON DELETE CASCADE;

-- Not a CHECK on nullability alone: a row with neither author is unattributable
-- and a row with both is ambiguous about who is being shown. Both are bugs, and
-- this is where they're cheapest to catch.
ALTER TABLE task_comments DROP CONSTRAINT IF EXISTS task_comments_one_author;
ALTER TABLE task_comments ADD CONSTRAINT task_comments_one_author
  CHECK (num_nonnulls(author_id, portal_author_id) = 1);

CREATE INDEX IF NOT EXISTS idx_task_comments_portal_author
  ON task_comments (portal_author_id) WHERE portal_author_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- The team's policies are unchanged except that "author" now has to mean an
-- auth user explicitly: author_id = auth.uid() was previously enough to imply
-- it, and with the column nullable a NULL would make the comparison NULL rather
-- than false. It already fails closed, but saying it plainly is worth more than
-- relying on that.
--
-- Portal users get no policy, as everywhere else in the portal: they are not
-- auth users, and every read and write goes through the service role behind a
-- verified portal token, scoped there by contact.
DROP POLICY IF EXISTS task_comments_insert ON task_comments;
CREATE POLICY task_comments_insert ON task_comments FOR INSERT
  WITH CHECK (author_id IS NOT NULL AND author_id = auth.uid() AND app_can_see_task(task_id));

DROP POLICY IF EXISTS task_comments_update ON task_comments;
CREATE POLICY task_comments_update ON task_comments FOR UPDATE
  USING (author_id IS NOT NULL AND author_id = auth.uid())
  WITH CHECK (author_id IS NOT NULL AND author_id = auth.uid());

DROP POLICY IF EXISTS task_comments_delete ON task_comments;
CREATE POLICY task_comments_delete ON task_comments FOR DELETE
  USING (author_id IS NOT NULL AND author_id = auth.uid());

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Playground · Social Corner — content calendar (social_brands + social_posts)
-- Date: 2026-07-06
--
-- A brand is a calendar space. It may link to a CRM contact (contact_id) or be
-- standalone (a brand you plan for that isn't a client yet). Posts belong to a
-- brand and sit on a calendar date. A post can be promoted to a work_task
-- (work_task_id) so it shows up on the main Tasks page.
--
-- Visibility: workspace-shared. RLS reuses the SECURITY DEFINER helpers
-- app_can_access_owner (any workspace member) / app_can_manage_owner
-- (owner + admin), the same pattern work_tasks uses. Any member can create and
-- edit brands/posts; deleting a brand (which cascades its posts) is owner/admin.
-- ════════════════════════════════════════════════════════════════════════════

-- ── social_brands (one calendar space per brand) ────────────────────────────────
CREATE TABLE IF NOT EXISTS social_brands (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id   UUID        REFERENCES crm_contacts(id) ON DELETE SET NULL,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),

  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- Pastel hex used to color-code the brand across the calendar.
  color        TEXT        NOT NULL CHECK (color ~* '^#[0-9a-f]{6}$'),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_brands_owner   ON social_brands (owner_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_brands_contact ON social_brands (contact_id) WHERE deleted_at IS NULL;

-- ── social_posts (one scheduled post on a brand's calendar) ─────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id   UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id       UUID        NOT NULL REFERENCES social_brands(id) ON DELETE CASCADE,
  created_by     UUID        NOT NULL REFERENCES auth.users(id),
  -- Set when the post is promoted to a task on the main Tasks page.
  work_task_id   UUID        REFERENCES work_tasks(id) ON DELETE SET NULL,

  scheduled_date DATE        NOT NULL,
  scheduled_time TIME,

  title          TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  content_pillar TEXT        CHECK (content_pillar IS NULL OR char_length(content_pillar) <= 100),
  format         TEXT        CHECK (format IS NULL OR format IN ('static', 'motion', 'carousel', 'story', 'reel', 'text')),
  visual_notes   TEXT        CHECK (visual_notes IS NULL OR char_length(visual_notes) <= 5000),
  caption        TEXT        CHECK (caption IS NULL OR char_length(caption) <= 5000),
  inspo_url      TEXT        CHECK (inspo_url IS NULL OR char_length(inspo_url) <= 2000),

  status         TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'pending_review', 'reviewed', 'approved')),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_posts_owner ON social_posts (owner_id)              WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_brand ON social_posts (brand_id)              WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_date  ON social_posts (owner_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_task  ON social_posts (work_task_id)          WHERE work_task_id IS NOT NULL;

-- updated_at is maintained by the repository layer (codebase convention — no
-- shared touch trigger exists in this schema).

-- ── RLS ─────────────────────────────────────────────────────────────────────────
ALTER TABLE social_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts  ENABLE ROW LEVEL SECURITY;

-- Brands: every workspace member can see, create, and edit. Deleting a brand
-- cascades its whole calendar, so that stays owner/admin.
CREATE POLICY social_brands_select ON social_brands FOR SELECT
  USING (app_can_access_owner(owner_id));
CREATE POLICY social_brands_insert ON social_brands FOR INSERT
  WITH CHECK (app_can_access_owner(owner_id) AND created_by = auth.uid());
CREATE POLICY social_brands_update ON social_brands FOR UPDATE
  USING (app_can_access_owner(owner_id))
  WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY social_brands_delete ON social_brands FOR DELETE
  USING (app_can_manage_owner(owner_id));

-- Posts: every workspace member has full control (soft-delete via update).
CREATE POLICY social_posts_select ON social_posts FOR SELECT
  USING (app_can_access_owner(owner_id));
CREATE POLICY social_posts_insert ON social_posts FOR INSERT
  WITH CHECK (app_can_access_owner(owner_id) AND created_by = auth.uid());
CREATE POLICY social_posts_update ON social_posts FOR UPDATE
  USING (app_can_access_owner(owner_id))
  WITH CHECK (app_can_access_owner(owner_id));
CREATE POLICY social_posts_delete ON social_posts FOR DELETE
  USING (app_can_manage_owner(owner_id));

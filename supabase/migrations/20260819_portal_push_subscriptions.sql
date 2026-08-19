-- ════════════════════════════════════════════════════════════════════════════
-- Push subscriptions for portal clients
--
-- push_subscriptions is keyed on auth.users, and portal clients aren't auth
-- users — they're rows in portal_users with a bcrypt hash. So they had nowhere
-- to store a subscription, which is why the portal could show a client a
-- notification in the bell but never on their phone.
--
-- Mirrors push_subscriptions, with one addition: base_path. A portal is served
-- at /client/* on the agency's own subdomain and at /portal/<slug>/* everywhere
-- else, and a push notification has to open the page on whichever origin the
-- device subscribed from. Storing the base the client was using at the time is
-- the only way to build that link later, from a server that can't see their
-- hostname.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID        NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  -- Denormalized so the owner can be given a read policy without a join, and so
  -- deleting an agency takes its clients' subscriptions with it.
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- One row per device. Re-subscribing on the same device updates in place.
  endpoint       TEXT        NOT NULL UNIQUE,
  p256dh         TEXT        NOT NULL,
  auth           TEXT        NOT NULL,
  -- Where this device reaches the portal: '/client' on the agency subdomain,
  -- '/portal/<slug>' otherwise. Prefixed to a notification's link at send time.
  base_path      TEXT        NOT NULL DEFAULT '/client',
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_push_user
  ON portal_push_subscriptions (portal_user_id);

ALTER TABLE portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Same posture as portal_notifications: the owner may see what their own
-- clients have registered; portal users get no policy at all, because they
-- never touch this table with a user-scoped client. Every write goes through
-- the service role behind a verified portal token.
DROP POLICY IF EXISTS portal_push_owner_select ON portal_push_subscriptions;
CREATE POLICY portal_push_owner_select ON portal_push_subscriptions FOR SELECT
  USING (owner_id = auth.uid());

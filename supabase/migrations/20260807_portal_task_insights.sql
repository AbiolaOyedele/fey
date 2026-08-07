-- ════════════════════════════════════════════════════════════════════════════
-- Portal task insights — per-client opt-in
-- Date: 2026-08-07
--
-- Adds the switch behind the client-facing Progress panel (portal → Tasks →
-- Progress). Off for every existing client by design: a client's portal must
-- not gain a new section because a deploy went out. The owner turns it on per
-- client from Clients → Portal Settings.
--
-- No new table and no new policy. crm_contacts already has RLS, and a new
-- column inherits the table's existing policies — the portal reads this through
-- a service-role client after the route has verified the portal JWT, exactly
-- like portal_enabled beside it.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS portal_insights_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN crm_contacts.portal_insights_enabled IS
  'When true, this client sees the Progress panel in their portal: tasks completed, on-time rate, typical turnaround, momentum, a breakdown by brand, and open work by urgency. Never per-teammate figures. Off by default.';

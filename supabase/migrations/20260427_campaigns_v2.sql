-- Campaigns v2: logo support + campaign-scoped files

-- Add logo column to client_campaigns
ALTER TABLE client_campaigns ADD COLUMN IF NOT EXISTS logo text DEFAULT '';

-- Add campaign_id to client_files (nullable) so files can belong to a campaign
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES client_campaigns(id) ON DELETE CASCADE;

-- Index for fast campaign-file lookups
CREATE INDEX IF NOT EXISTS idx_client_files_campaign_id ON client_files(campaign_id);

-- Allow public (shared-page) read of campaign files via client_id
-- (existing client_files RLS already covers owner; shared pages read by client_id which includes campaign files)

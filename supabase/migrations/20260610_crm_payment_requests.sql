-- CRM direct payment requests
-- A lightweight alternative to invoices: owner sets amount + description,
-- gets a shareable link the client opens to pay via Paystack.

CREATE TABLE IF NOT EXISTS crm_payment_requests (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id          UUID          REFERENCES crm_contacts(id) ON DELETE SET NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency            TEXT          NOT NULL DEFAULT 'NGN',
  description         TEXT          NOT NULL DEFAULT '',
  message             TEXT          NOT NULL DEFAULT '',
  status              TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','expired','cancelled')),
  share_token         TEXT          UNIQUE NOT NULL
                        DEFAULT encode(gen_random_bytes(16), 'hex'),
  paystack_reference  TEXT,
  paid_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE crm_payment_requests ENABLE ROW LEVEL SECURITY;

-- Owner can fully manage their own requests
CREATE POLICY "crm_payment_requests_owner_all" ON crm_payment_requests
  FOR ALL
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anonymous/public can read a pending request by knowing its token
-- (the API route uses service role for writes; this lets the public page read)
CREATE POLICY "crm_payment_requests_anon_read" ON crm_payment_requests
  FOR SELECT
  TO anon
  USING (status = 'pending');

CREATE INDEX IF NOT EXISTS crm_payment_requests_owner_idx   ON crm_payment_requests (owner_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS crm_payment_requests_contact_idx ON crm_payment_requests (contact_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS crm_payment_requests_token_idx   ON crm_payment_requests (share_token);

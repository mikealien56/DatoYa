ALTER TABLE founder_invites ADD COLUMN IF NOT EXISTS invitee_email TEXT;
ALTER TABLE founder_invites ADD COLUMN IF NOT EXISTS invitee_business_name TEXT;
ALTER TABLE founder_invites ADD COLUMN IF NOT EXISTS used_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE founder_invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_founder_invites_invitee_email ON founder_invites(invitee_email);

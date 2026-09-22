-- Soporte conversacional para cuentas de negocio.
-- Migración aditiva e idempotente.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS business_id BIGINT REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_cases_user ON support_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_business ON support_cases(business_id);

CREATE TABLE IF NOT EXISTS support_case_messages (
  id BIGSERIAL PRIMARY KEY,
  support_case_id BIGINT NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  sender_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('business','admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_case_messages_case
  ON support_case_messages(support_case_id,id);

-- Casos de soporte enviados desde datoya.cl
-- Migración aditiva e idempotente.
CREATE TABLE IF NOT EXISTS support_cases (
  id BIGSERIAL PRIMARY KEY,
  case_ref TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','resolved')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','failed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_cases_ref ON support_cases(case_ref);
CREATE INDEX IF NOT EXISTS idx_support_cases_email ON support_cases(email);
CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases(status);

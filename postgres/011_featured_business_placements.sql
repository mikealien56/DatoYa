CREATE TABLE IF NOT EXISTS featured_business_placements (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  comuna_id BIGINT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'paid',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  reference TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  provider_status TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_featured_business_zone ON featured_business_placements(comuna_id,status,starts_at,ends_at);

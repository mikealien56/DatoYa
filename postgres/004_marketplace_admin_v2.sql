-- Admin marketplace V2: membresías pagadas/cortesías DatoYa Impulso.
CREATE TABLE IF NOT EXISTS business_impulse_memberships (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'impulso' CHECK(plan IN ('impulso')),
  billing_period TEXT NOT NULL DEFAULT 'gift' CHECK(billing_period IN ('gift','monthly','annual')),
  source TEXT NOT NULL DEFAULT 'gift' CHECK(source IN ('gift','paid','manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','expired','cancelled','superseded')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  days_granted INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_reference TEXT,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_impulse_memberships_business ON business_impulse_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_business_impulse_memberships_status ON business_impulse_memberships(status);

CREATE TABLE IF NOT EXISTS business_impulse_payments (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  billing_period TEXT NOT NULL CHECK(billing_period IN ('monthly','annual')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','expired','failed')),
  preference_id TEXT,
  payment_id TEXT,
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_impulse_payments_business ON business_impulse_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_business_impulse_payments_status ON business_impulse_payments(status);

INSERT INTO settings(key,value) VALUES('impulso_monthly_price','9990') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES('impulso_annual_price','99900') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES('impulso_free_catalog_limit','20') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES('weekly_impulse_days','7') ON CONFLICT(key) DO NOTHING;

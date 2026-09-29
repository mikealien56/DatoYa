-- Alta simple de cobros Khipu por negocio.
-- No almacena claves bancarias ni credenciales secretas de Khipu.
CREATE TABLE IF NOT EXISTS business_khipu_onboarding (
  business_id BIGINT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  owner_first_name TEXT,
  owner_last_name TEXT,
  owner_email TEXT,
  country_code TEXT NOT NULL DEFAULT 'CL',
  billing_identifier TEXT,
  business_activity TEXT,
  billing_name TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_region TEXT,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  receiver_id TEXT,
  provider_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_khipu_onboarding_status ON business_khipu_onboarding(status);

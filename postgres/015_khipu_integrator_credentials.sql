-- Reserved server-only encrypted credentials; no existing records are changed.
CREATE TABLE IF NOT EXISTS business_khipu_credentials (
  business_id BIGINT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL UNIQUE,
  encrypted_credentials TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  activation_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

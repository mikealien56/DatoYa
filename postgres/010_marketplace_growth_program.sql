CREATE TABLE IF NOT EXISTS founder_invites (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_growth_profiles (
  business_id BIGINT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  is_founder INTEGER NOT NULL DEFAULT 0,
  founder_code TEXT UNIQUE,
  referred_by_business_id BIGINT REFERENCES businesses(id) ON DELETE SET NULL,
  invitation_code TEXT,
  launch_free_order_limit INTEGER NOT NULL DEFAULT 5,
  launch_free_orders_used INTEGER NOT NULL DEFAULT 0,
  founder_reward_days INTEGER NOT NULL DEFAULT 0,
  founder_benefit_applied INTEGER NOT NULL DEFAULT 0,
  referral_benefit_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_referrals (
  id BIGSERIAL PRIMARY KEY,
  founder_business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id BIGINT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_orders INTEGER NOT NULL DEFAULT 0,
  reward_days INTEGER NOT NULL DEFAULT 0,
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_referrals_founder ON business_referrals(founder_business_id,status);

-- Commerce tables are optional in the PostgreSQL core bootstrap. Apply these
-- additions when present; migrations rerun on startup if commerce is installed
-- later. Keep each table's changes together and idempotent.
DO $growth$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS datoya_exclusive INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF to_regclass('public.commerce_orders') IS NOT NULL THEN
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commission_rate_effective DOUBLE PRECISION;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commission_cap BIGINT;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commission_tier TEXT;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commission_waived_reason TEXT;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS exclusive_subtotal BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS launch_free_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END; $growth$;

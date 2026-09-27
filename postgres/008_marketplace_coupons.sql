CREATE TABLE IF NOT EXISTS market_coupons (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value BIGINT NOT NULL,
  max_discount BIGINT,
  min_order BIGINT NOT NULL DEFAULT 0,
  funding_source TEXT NOT NULL DEFAULT 'business',
  datoya_share_pct INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 50,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id,code)
);
CREATE INDEX IF NOT EXISTS idx_market_coupons_business_active ON market_coupons(business_id,active);
CREATE INDEX IF NOT EXISTS idx_market_coupons_code ON market_coupons(code);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT NOT NULL REFERENCES market_coupons(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  business_funded_amount BIGINT NOT NULL DEFAULT 0,
  datoya_funded_amount BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_user ON coupon_redemptions(coupon_id,user_id,status);
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_id BIGINT;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_discount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_business_funded BIGINT NOT NULL DEFAULT 0;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS coupon_datoya_funded BIGINT NOT NULL DEFAULT 0;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commission_base BIGINT;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS datoya_commission_estimate BIGINT;

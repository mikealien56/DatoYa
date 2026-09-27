CREATE TABLE IF NOT EXISTS commerce_refund_requests (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  order_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','escalated','processing','refunded','cancelled')),
  reason_code TEXT NOT NULL,
  reason_text TEXT,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  commission_refund_amount INTEGER NOT NULL DEFAULT 0,
  business_note TEXT,
  admin_note TEXT,
  provider TEXT,
  provider_refund_id TEXT,
  provider_status TEXT,
  requested_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  reviewed_at TEXT,
  escalated_at TEXT,
  refunded_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE INDEX IF NOT EXISTS idx_commerce_refunds_order ON commerce_refund_requests(order_id,id);
CREATE INDEX IF NOT EXISTS idx_commerce_refunds_business ON commerce_refund_requests(business_id,status,id);
CREATE INDEX IF NOT EXISTS idx_commerce_refunds_user ON commerce_refund_requests(user_id,id);

CREATE TABLE IF NOT EXISTS commerce_refund_events (
  id BIGSERIAL PRIMARY KEY,
  refund_id BIGINT NOT NULL REFERENCES commerce_refund_requests(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  note TEXT,
  amount INTEGER,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS idx_commerce_refund_events_refund ON commerce_refund_events(refund_id,id);

DO $$
BEGIN
  IF to_regclass('public.commerce_orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname='fk_commerce_refund_order'
         AND conrelid='commerce_refund_requests'::regclass
     )
  THEN
    ALTER TABLE commerce_refund_requests
      ADD CONSTRAINT fk_commerce_refund_order
      FOREIGN KEY(order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

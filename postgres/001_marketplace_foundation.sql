-- Base comercial de DatoYa para PostgreSQL limpio.
-- Debe ejecutarse después de 001_initial_schema.sql y antes de 002_market_account_types.sql.

CREATE TABLE IF NOT EXISTS market_categories (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏪',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  business_type TEXT NOT NULL DEFAULT 'physical_store'
    CHECK(business_type IN ('physical_store','home_business')),
  comuna_id BIGINT REFERENCES comunas(id),
  province_id BIGINT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy DOUBLE PRECISION,
  location_source TEXT NOT NULL DEFAULT 'manual',
  sector TEXT,
  address TEXT,
  public_address_mode TEXT NOT NULL DEFAULT 'approximate'
    CHECK(public_address_mode IN ('approximate','exact','hidden')),
  phone TEXT,
  whatsapp TEXT,
  opening_hours TEXT,
  pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK(pickup_enabled IN (0,1)),
  delivery_enabled INTEGER NOT NULL DEFAULT 0 CHECK(delivery_enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK(status IN ('draft','pending_review','active','paused','rejected','suspended')),
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_comuna ON businesses(comuna_id);

CREATE TABLE IF NOT EXISTS business_category_links (
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES market_categories(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  PRIMARY KEY (business_id, category_id)
);

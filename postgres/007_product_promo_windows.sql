-- DatoYa: ventanas horarias opcionales para promociones de productos.
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS promo_starts_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;

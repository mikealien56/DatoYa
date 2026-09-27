CREATE TABLE IF NOT EXISTS market_coupon_products (
  coupon_id BIGINT NOT NULL REFERENCES market_coupons(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  PRIMARY KEY (coupon_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_market_coupon_products_product ON market_coupon_products(product_id);

CREATE TABLE IF NOT EXISTS market_coupon_categories (
  coupon_id BIGINT NOT NULL REFERENCES market_coupons(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES market_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_market_coupon_categories_category ON market_coupon_categories(category_id);

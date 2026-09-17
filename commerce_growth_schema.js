// Promociones, DatoYa Impulso e Impulso Ahora. Esquema aditivo y separado del PRO legacy.
const {db}=require('./db');
db.exec(`
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id), title TEXT NOT NULL, description TEXT, image_url TEXT,
  price INTEGER, previous_price INTEGER, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL, billing_period TEXT, status TEXT NOT NULL CHECK(status IN ('pending','active','expired','cancelled')),
  source TEXT NOT NULL CHECK(source IN ('mercadopago','grant','manual')), starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT, auto_renew INTEGER NOT NULL DEFAULT 0 CHECK(auto_renew IN (0,1)), amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscription_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id), reason TEXT NOT NULL, days INTEGER NOT NULL, starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS impulse_now (
  id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id), title TEXT NOT NULL, description TEXT, image_url TEXT,
  price INTEGER NOT NULL CHECK(price >= 0), previous_price INTEGER, stock_initial INTEGER NOT NULL CHECK(stock_initial >= 0),
  stock_remaining INTEGER NOT NULL CHECK(stock_remaining >= 0), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  until_sold_out INTEGER NOT NULL DEFAULT 1 CHECK(until_sold_out IN (0,1)), pickup_enabled INTEGER NOT NULL DEFAULT 0,
  delivery_enabled INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','active','low_stock','sold_out','ended','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promotions_window ON promotions(active,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_impulse_window ON impulse_now(status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_active ON business_subscriptions(business_id,status,expires_at);
`);
for(const [key,value] of [['business_impulso_monthly_clp','9990'],['business_impulso_annual_clp','99900']])if(!db.prepare('SELECT 1 FROM settings WHERE key=?').get(key))db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(key,value);
module.exports={db};

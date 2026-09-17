// DatoYa — dominio comercial aditivo. No elimina ni modifica tablas legacy.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','merchant','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  business_type TEXT NOT NULL CHECK(business_type IN ('physical_store','home_business')),
  main_category_id INTEGER REFERENCES categories(id),
  phone TEXT,
  whatsapp TEXT,
  email_public TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  address TEXT,
  public_address TEXT,
  public_location_mode TEXT NOT NULL DEFAULT 'approximate' CHECK(public_location_mode IN ('exact','approximate','comuna_only')),
  sector TEXT,
  pickup_instructions TEXT,
  province_id INTEGER,
  comuna_id INTEGER REFERENCES comunas(id),
  region_id INTEGER REFERENCES regions(id),
  latitude REAL,
  longitude REAL,
  location_accuracy REAL,
  show_exact_address INTEGER NOT NULL DEFAULT 0 CHECK(show_exact_address IN (0,1)),
  pickup_enabled INTEGER NOT NULL DEFAULT 0 CHECK(pickup_enabled IN (0,1)),
  delivery_enabled INTEGER NOT NULL DEFAULT 0 CHECK(delivery_enabled IN (0,1)),
  delivery_radius_km REAL NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  opening_status TEXT NOT NULL DEFAULT 'open' CHECK(opening_status IN ('open','temporarily_closed','closed_today','vacation')),
  logo_url TEXT,
  cover_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  verified_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verified_status IN ('unverified','pending','verified','rejected')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','impulso')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','active','paused','rejected','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_categories (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  PRIMARY KEY (business_id, category_id)
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0),
  promo_price INTEGER CHECK(promo_price IS NULL OR promo_price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  stock_tracking INTEGER NOT NULL DEFAULT 0 CHECK(stock_tracking IN (0,1)),
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, slug)
);
CREATE TABLE IF NOT EXISTS business_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gallery' CHECK(type IN ('gallery','logo','cover')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  open_time TEXT,
  close_time TEXT,
  closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1)),
  UNIQUE(business_id, day_of_week)
);
CREATE TABLE IF NOT EXISTS business_favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id,business_id)
);
CREATE TABLE IF NOT EXISTS business_metrics (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  visits INTEGER NOT NULL DEFAULT 0,
  whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status_location ON businesses(status,latitude,longitude);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(main_category_id,status);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id,active,available);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
`);

function column(table, name, sql) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${sql}`);
  }
}

// Se amplía categories sin cambiar su uso legacy.
column('categories', 'slug', 'TEXT');
column('categories', 'color', "TEXT NOT NULL DEFAULT '#FF6B35'");
column('categories', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
column('categories', 'domain', "TEXT NOT NULL DEFAULT 'legacy'");

const commercial = [
  ['Restaurantes','restaurantes','🍽️','#FF6B35',10],['Comida rápida','comida-rapida','🍔','#FF7A45',20],
  ['Cafeterías','cafeterias','☕','#9B6B43',30],['Panaderías','panaderias','🥐','#E3A22F',40],
  ['Pastelerías','pastelerias','🍰','#E46E9B',50],['Almacenes','almacenes','🧺','#3C8C63',60],
  ['Minimarkets','minimarkets','🛒','#3586D4',70],['Farmacias','farmacias','✚','#12A67A',80],
  ['Ferreterías','ferreterias','🔨','#627384',90],['Mascotas','mascotas','🐾','#DF6688',100],
  ['Belleza','belleza','✂️','#9A66CC',110],['Ropa','ropa','👕','#376BD6',120],
  ['Regalos','regalos','🎁','#D65D76',130],['Librerías','librerias','📚','#4F73A8',140],
  ['Tecnología','tecnologia','💻','#4356B5',150],['Hogar','hogar','🏠','#3A8A90',160],
  ['Emprendimientos','emprendimientos','✨','#F06C3D',170]
];
const bySlug = db.prepare('SELECT id FROM categories WHERE slug=?');
for (const [name,slug,icon,color,order] of commercial) {
  const existing = bySlug.get(slug);
  if (existing) db.prepare("UPDATE categories SET name=?,icon=?,color=?,sort_order=?,active=1,domain='commercial' WHERE id=?").run(name,icon,color,order,existing.id);
  else db.prepare("INSERT INTO categories(name,icon,active,slug,color,sort_order,domain) VALUES(?,?,1,?,?,?,'commercial')").run(name,icon,slug,color,order);
}

module.exports = { db };

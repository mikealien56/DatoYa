// Ubicación de usuario aditiva. No altera ni elimina datos legacy.
const {db}=require('./db');
db.exec(`
CREATE TABLE IF NOT EXISTS user_locations (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL, longitude REAL, accuracy REAL,
  region_id INTEGER REFERENCES regions(id), province_id INTEGER,
  comuna_id INTEGER REFERENCES comunas(id),
  location_source TEXT NOT NULL CHECK(location_source IN ('gps','manual','reverse_geocode','centroid_fallback')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS territory_geocode_cache (
  cache_key TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL,
  region_id INTEGER REFERENCES regions(id), comuna_id INTEGER REFERENCES comunas(id),
  provider TEXT NOT NULL, confidence TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
module.exports={db};

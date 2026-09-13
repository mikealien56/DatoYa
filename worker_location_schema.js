// DatoYa 2.0 — ubicación GPS aproximada del profesional para búsqueda por cercanía.
// Se guarda una ubicación de referencia aproximada, no una dirección.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS worker_locations (
  worker_id INTEGER PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL,
  consent INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(worker_id) REFERENCES worker_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_worker_locations_coords ON worker_locations(lat,lng);
`);

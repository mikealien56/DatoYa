// DatoYa 2.0 — esquema para ubicación GPS aproximada de profesionales
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS worker_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL UNIQUE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL,
  consent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_worker_locations_worker ON worker_locations(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_locations_consent ON worker_locations(consent, updated_at);
`);

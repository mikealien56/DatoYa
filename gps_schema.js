// DatoYa — esquema de GPS durante el viaje (DEMO)
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS job_travel_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE,
  started_by INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'EN_CAMINO' CHECK(status IN ('EN_CAMINO','LLEGADA_REGISTRADA','FINALIZADA')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  arrived_at TEXT,
  start_lat REAL,
  start_lng REAL,
  start_accuracy REAL,
  arrival_lat REAL,
  arrival_lng REAL,
  arrival_accuracy REAL,
  arrival_method TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS job_location_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  travel_session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('tracking_started','location_update','arrival_registered','tracking_stopped')),
  lat REAL,
  lng REAL,
  accuracy REAL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_location_events_job ON job_location_events(job_id, created_at);
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

function setting(name, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(name);
  return row ? row.value : fallback;
}

if (!db.prepare('SELECT 1 FROM settings WHERE key=?').get('gps_arrival_radius_m')) db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('gps_arrival_radius_m','100');
if (!db.prepare('SELECT 1 FROM settings WHERE key=?').get('gps_max_accuracy_m')) db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('gps_max_accuracy_m','150');

// DatoYa 2.0 — eventos auditables de trabajos.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id, id);
CREATE INDEX IF NOT EXISTS idx_job_events_type ON job_events(event_type, created_at);
`);

module.exports = { db };

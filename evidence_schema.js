// DatoYa — Evidencias de trabajos
// Demo: almacenamiento local. Producción: reemplazar el adapter por S3/Cloudinary u otro storage seguro.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS job_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploader_user_id INTEGER NOT NULL REFERENCES users(id),
  stage TEXT NOT NULL CHECK(stage IN ('ANTES','PROCESO','DESPUES')),
  storage_key TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_evidence_job ON job_evidence(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_evidence_stage ON job_evidence(job_id, stage);
`);

module.exports = { db };

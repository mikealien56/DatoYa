// DatoYa — disputas y correcciones (DEMO)
// Registra el ciclo de revisión sin mover dinero real.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS job_disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  opened_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK(status IN ('OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW','PARTIAL_REFUND','REFUNDED','RELEASED','RESOLVED')),
  resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_disputes_job ON job_disputes(job_id, id);
CREATE INDEX IF NOT EXISTS idx_job_disputes_status ON job_disputes(status);

CREATE TABLE IF NOT EXISTS job_dispute_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispute_id INTEGER NOT NULL REFERENCES job_disputes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id),
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_dispute_events ON job_dispute_events(dispute_id, created_at);
`);

module.exports = { db };

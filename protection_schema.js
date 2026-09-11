// DatoYa — esquema para Protección DatoYa (modo DEMO)
// No procesa dinero real. Modela retención, revisión y resolución para preparar la integración de pagos.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS payment_protections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  service_amount INTEGER NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 10,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  protection_pct REAL NOT NULL DEFAULT 5,
  protection_amount INTEGER NOT NULL DEFAULT 0,
  client_total INTEGER NOT NULL DEFAULT 0,
  worker_net INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'HELD'
    CHECK(status IN ('HELD','AWAITING_CONFIRMATION','RELEASED','DISPUTED','CORRECTION','REFUNDED','PARTIAL_REFUND')),
  review_deadline TEXT,
  dispute_reason TEXT,
  resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_protection_status ON payment_protections(status);

CREATE TABLE IF NOT EXISTS payment_protection_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protection_id INTEGER NOT NULL REFERENCES payment_protections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id),
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_protection_events ON payment_protection_events(protection_id, created_at);
`);

const settings = [
  ['protection_pct','5'],
  ['protection_review_hours','24'],
  ['protection_enabled','1']
];
const put = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING');
for (const [k,v] of settings) put.run(k,v);

module.exports = { db };

// DatoYa — esquema de seguridad, auditoría y operaciones avanzadas
// Migración idempotente: no borra datos DEMO ni altera tablas existentes.
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  metadata TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  target_user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('no_show','cancelacion','conducta','fraude','danos','incumplimiento','otro')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_revision','confirmado','rechazado','apelado','cerrado')),
  resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

CREATE TABLE IF NOT EXISTS sanctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  level TEXT NOT NULL CHECK(level IN ('NORMAL','ADVERTENCIA','OBSERVACION','RIESGO','RESTRINGIDO','SUSPENDIDO','BLOQUEADO')),
  reason TEXT NOT NULL,
  incident_id INTEGER REFERENCES incidents(id),
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sanctions_user_active ON sanctions(user_id, active);

CREATE TABLE IF NOT EXISTS appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  sanction_id INTEGER REFERENCES sanctions(id),
  incident_id INTEGER REFERENCES incidents(id),
  reason TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_revision','aceptada','rechazada','cerrada')),
  resolution TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  payment_id INTEGER REFERENCES payments(id),
  type TEXT NOT NULL CHECK(type IN ('INGRESO','COMISION','REEMBOLSO','AJUSTE','RETIRO')),
  amount INTEGER NOT NULL,
  reference TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_date ON ledger_entries(user_id, created_at);

CREATE TABLE IF NOT EXISTS verification_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verification_request_id INTEGER NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'privado' CHECK(status IN ('privado','en_revision','aprobado','rechazado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  UNIQUE(user_id, policy_key, policy_version)
);

CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_key TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(policy_key, version)
);

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
CREATE INDEX IF NOT EXISTS idx_job_events_job_date ON job_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS job_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  phase TEXT NOT NULL CHECK(phase IN ('problema','antes','durante','final')),
  storage_key TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id, phase);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quotes INTEGER NOT NULL DEFAULT 1,
  jobs INTEGER NOT NULL DEFAULT 1,
  messages INTEGER NOT NULL DEFAULT 1,
  payments INTEGER NOT NULL DEFAULT 1,
  marketing INTEGER NOT NULL DEFAULT 0
);

// Compatibilidad futura: radio de trabajo configurable por profesional.
const cols = db.prepare('PRAGMA table_info(worker_profiles)').all().map(x => x.name);
if (!cols.includes('work_radius_km')) db.exec('ALTER TABLE worker_profiles ADD COLUMN work_radius_km REAL NOT NULL DEFAULT 25');
if (!cols.includes('availability_note')) db.exec('ALTER TABLE worker_profiles ADD COLUMN availability_note TEXT');
if (!cols.includes('verification_level')) db.exec("ALTER TABLE worker_profiles ADD COLUMN verification_level TEXT NOT NULL DEFAULT 'none'");

// Configuración operativa centralizada.
const settings = [
  ['commission_pct','10'],
  ['work_geofence_m','100'],
  ['quote_expiry_hours','72'],
  ['max_request_photos','8'],
  ['max_job_photos','20'],
  ['pro_price','9990']
];
const put = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING');
for (const [k,v] of settings) put.run(k,v);

module.exports = { db };

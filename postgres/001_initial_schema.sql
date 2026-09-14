BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK(role IN ('cliente','trabajador','admin')),
  comuna_id BIGINT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS comunas (
  id BIGSERIAL PRIMARY KEY,
  region_id BIGINT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  UNIQUE(region_id, name)
);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_comuna_id_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_comuna_id_fkey FOREIGN KEY (comuna_id) REFERENCES comunas(id);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔧',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE IF NOT EXISTS worker_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oficio TEXT NOT NULL,
  description TEXT,
  years_experience INTEGER DEFAULT 0,
  price_from INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponible' CHECK(status IN ('disponible','ocupado','no_disponible')),
  comuna_id BIGINT REFERENCES comunas(id),
  verified_identity INTEGER NOT NULL DEFAULT 0 CHECK(verified_identity IN (0,1)),
  verified_phone INTEGER NOT NULL DEFAULT 0 CHECK(verified_phone IN (0,1)),
  is_recommended INTEGER NOT NULL DEFAULT 0 CHECK(is_recommended IN (0,1)),
  is_pro INTEGER NOT NULL DEFAULT 0 CHECK(is_pro IN (0,1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)),
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  rating_avg DOUBLE PRECISION NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  response_rate INTEGER NOT NULL DEFAULT 95,
  completion_rate INTEGER NOT NULL DEFAULT 98,
  member_since DATE NOT NULL DEFAULT CURRENT_DATE,
  avatar_color TEXT DEFAULT '#1D4ED8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_categories (
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY(worker_id, category_id)
);

CREATE TABLE IF NOT EXISTS worker_comunas (
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  comuna_id BIGINT NOT NULL REFERENCES comunas(id) ON DELETE CASCADE,
  PRIMARY KEY(worker_id, comuna_id)
);

CREATE TABLE IF NOT EXISTS portfolio_images (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '🛠️',
  caption TEXT,
  storage_key TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES users(id),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT DEFAULT '[]',
  comuna_id BIGINT REFERENCES comunas(id),
  address_detail TEXT,
  urgency TEXT NOT NULL DEFAULT 'lo_antes_posible',
  preferred_date DATE,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'abierta' CHECK(status IN ('abierta','en_proceso','cerrada','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  price INTEGER NOT NULL,
  description TEXT,
  available_date DATE,
  duration_estimate TEXT,
  materials_included INTEGER NOT NULL DEFAULT 0 CHECK(materials_included IN (0,1)),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aceptada','rechazada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, worker_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES service_requests(id),
  quote_id BIGINT NOT NULL REFERENCES quotes(id),
  client_id BIGINT NOT NULL REFERENCES users(id),
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  status TEXT NOT NULL DEFAULT 'TRABAJADOR_SELECCIONADO' CHECK(status IN ('SOLICITADO','COTIZANDO','TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','FINALIZADO','CANCELADO','DISPUTA')),
  price INTEGER NOT NULL,
  commission_pct DOUBLE PRECISION NOT NULL DEFAULT 10,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  worker_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_status_history (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES service_requests(id),
  job_id BIGINT REFERENCES jobs(id),
  client_id BIGINT NOT NULL REFERENCES users(id),
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, client_id, worker_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id BIGINT NOT NULL REFERENCES users(id),
  reviewee_id BIGINT NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK(direction IN ('cliente_a_trabajador','trabajador_a_cliente')),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  quality INTEGER,
  punctuality INTEGER,
  treatment INTEGER,
  price_rating INTEGER,
  comment TEXT,
  reported INTEGER NOT NULL DEFAULT 0 CHECK(reported IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, direction)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id),
  amount INTEGER NOT NULL,
  commission INTEGER NOT NULL,
  worker_amount INTEGER NOT NULL,
  method TEXT DEFAULT 'tarjeta',
  provider TEXT NOT NULL DEFAULT 'DEMO',
  status TEXT NOT NULL DEFAULT 'demo_completado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id),
  pct DOUBLE PRECISION NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('usuario','resena','trabajo')),
  target_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','resuelta','descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  type TEXT NOT NULL CHECK(type IN ('identidad','telefono','antecedentes')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada','rechazada')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_documents (
  id BIGSERIAL PRIMARY KEY,
  verification_request_id BIGINT NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_history (
  id BIGSERIAL PRIMARY KEY,
  verification_request_id BIGINT REFERENCES verification_requests(id) ON DELETE CASCADE,
  worker_id BIGINT REFERENCES worker_profiles(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id),
  event_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  plan TEXT NOT NULL DEFAULT 'PRO',
  status TEXT NOT NULL DEFAULT 'activa',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, worker_id)
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES worker_profiles(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','pagado','rechazado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id, id);
CREATE INDEX IF NOT EXISTS idx_job_events_type ON job_events(event_type, created_at);

CREATE TABLE IF NOT EXISTS job_evidence (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploader_user_id BIGINT NOT NULL REFERENCES users(id),
  stage TEXT NOT NULL CHECK(stage IN ('ANTES','PROCESO','DESPUES')),
  storage_key TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  note TEXT,
  data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_evidence_job ON job_evidence(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_evidence_stage ON job_evidence(job_id, stage);

CREATE TABLE IF NOT EXISTS worker_locations (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL UNIQUE REFERENCES worker_profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN (0,1)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_locations_consent ON worker_locations(consent, updated_at);

CREATE TABLE IF NOT EXISTS job_travel_sessions (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  started_by BIGINT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'EN_CAMINO' CHECK(status IN ('EN_CAMINO','LLEGADA_REGISTRADA','FINALIZADA')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  start_accuracy DOUBLE PRECISION,
  arrival_lat DOUBLE PRECISION,
  arrival_lng DOUBLE PRECISION,
  arrival_accuracy DOUBLE PRECISION,
  arrival_method TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_location_events (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  travel_session_id BIGINT NOT NULL REFERENCES job_travel_sessions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('tracking_started','location_update','arrival_registered','tracking_stopped')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_location_events_job ON job_location_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS payment_protections (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  service_amount INTEGER NOT NULL,
  commission_pct DOUBLE PRECISION NOT NULL DEFAULT 10,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  protection_pct DOUBLE PRECISION NOT NULL DEFAULT 5,
  protection_amount INTEGER NOT NULL DEFAULT 0,
  client_total INTEGER NOT NULL DEFAULT 0,
  worker_net INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'HELD' CHECK(status IN ('HELD','AWAITING_CONFIRMATION','RELEASED','DISPUTED','CORRECTION','REFUNDED','PARTIAL_REFUND')),
  review_deadline TIMESTAMPTZ,
  dispute_reason TEXT,
  resolution TEXT,
  resolved_by BIGINT REFERENCES users(id),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_protection_status ON payment_protections(status);

CREATE TABLE IF NOT EXISTS payment_protection_events (
  id BIGSERIAL PRIMARY KEY,
  protection_id BIGINT NOT NULL REFERENCES payment_protections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id BIGINT REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_disputes (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  opened_by BIGINT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW','PARTIAL_REFUND','REFUNDED','RELEASED','RESOLVED')),
  resolution TEXT,
  resolved_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_job_disputes_job ON job_disputes(job_id, id);
CREATE INDEX IF NOT EXISTS idx_job_disputes_status ON job_disputes(status);

CREATE TABLE IF NOT EXISTS job_dispute_events (
  id BIGSERIAL PRIMARY KEY,
  dispute_id BIGINT NOT NULL REFERENCES job_disputes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id BIGINT REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id BIGINT,
  metadata JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_photos (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  phase TEXT NOT NULL CHECK(phase IN ('problema','antes','durante','final')),
  storage_key TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1 CHECK(is_private IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id),
  job_id BIGINT REFERENCES jobs(id),
  target_user_id BIGINT REFERENCES users(id),
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  resolution TEXT,
  resolved_by BIGINT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanctions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  incident_id BIGINT REFERENCES incidents(id),
  type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appeals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  sanction_id BIGINT REFERENCES sanctions(id),
  incident_id BIGINT REFERENCES incidents(id),
  reason TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  resolution TEXT,
  resolved_by BIGINT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  job_id BIGINT REFERENCES jobs(id),
  payment_id BIGINT REFERENCES payments(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings(key,value) VALUES
  ('commission_pct','10'),
  ('pro_price','9990'),
  ('featured_price','4990'),
  ('protection_pct','5'),
  ('protection_review_hours','24'),
  ('protection_enabled','1'),
  ('gps_arrival_radius_m','100'),
  ('gps_max_accuracy_m','150'),
  ('max_job_photos','20')
ON CONFLICT(key) DO NOTHING;

COMMIT;

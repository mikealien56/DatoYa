// DatoYa — Base de datos SQLite: esquema + datos DEMO
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'datoya.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// ============ ESQUEMA ============
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK(role IN ('cliente','trabajador','admin')),
  comuna_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT
);
CREATE TABLE IF NOT EXISTS comunas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL,
  lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔧',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS worker_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oficio TEXT NOT NULL,
  description TEXT,
  years_experience INTEGER DEFAULT 0,
  price_from INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponible' CHECK(status IN ('disponible','ocupado','no_disponible')),
  comuna_id INTEGER REFERENCES comunas(id),
  verified_identity INTEGER NOT NULL DEFAULT 0,
  verified_phone INTEGER NOT NULL DEFAULT 0,
  is_recommended INTEGER NOT NULL DEFAULT 0,
  is_pro INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  response_rate INTEGER NOT NULL DEFAULT 95,
  completion_rate INTEGER NOT NULL DEFAULT 98,
  member_since TEXT NOT NULL DEFAULT (date('now')),
  avatar_color TEXT DEFAULT '#1D4ED8',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS worker_categories (
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, category_id)
);
CREATE TABLE IF NOT EXISTS worker_comunas (
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  comuna_id INTEGER NOT NULL REFERENCES comunas(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, comuna_id)
);
CREATE TABLE IF NOT EXISTS portfolio_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '🛠️',
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT DEFAULT '[]',
  comuna_id INTEGER REFERENCES comunas(id),
  address_detail TEXT,
  urgency TEXT NOT NULL DEFAULT 'lo_antes_posible',
  preferred_date TEXT,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'abierta' CHECK(status IN ('abierta','en_proceso','cerrada','cancelada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  price INTEGER NOT NULL,
  description TEXT,
  available_date TEXT,
  duration_estimate TEXT,
  materials_included INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aceptada','rechazada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id),
  quote_id INTEGER NOT NULL REFERENCES quotes(id),
  client_id INTEGER NOT NULL REFERENCES users(id),
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  status TEXT NOT NULL DEFAULT 'TRABAJADOR_SELECCIONADO'
    CHECK(status IN ('SOLICITADO','COTIZANDO','TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','FINALIZADO','CANCELADO','DISPUTA')),
  price INTEGER NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 10,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  worker_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS job_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER REFERENCES service_requests(id),
  job_id INTEGER REFERENCES jobs(id),
  client_id INTEGER NOT NULL REFERENCES users(id),
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, client_id, worker_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  reviewee_id INTEGER NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK(direction IN ('cliente_a_trabajador','trabajador_a_cliente')),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  quality INTEGER, punctuality INTEGER, treatment INTEGER, price_rating INTEGER,
  comment TEXT,
  reported INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, direction)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  amount INTEGER NOT NULL,
  commission INTEGER NOT NULL,
  worker_amount INTEGER NOT NULL,
  method TEXT DEFAULT 'tarjeta',
  provider TEXT NOT NULL DEFAULT 'DEMO',
  status TEXT NOT NULL DEFAULT 'demo_completado',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  pct REAL NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('usuario','resena','trabajo')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','resuelta','descartada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  type TEXT NOT NULL CHECK(type IN ('identidad','telefono')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada','rechazada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  plan TEXT NOT NULL DEFAULT 'PRO',
  status TEXT NOT NULL DEFAULT 'activa',
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_id, worker_id)
);
CREATE TABLE IF NOT EXISTS payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','pagado','rechazado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function getSetting(key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
function notify(userId, type, text, link) {
  db.prepare('INSERT INTO notifications(user_id,type,text,link) VALUES(?,?,?,?)').run(userId, type, text, link || null);
}

// ============ SEED ============
function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  console.log('[DatoYa] Sembrando datos DEMO...');

  setSetting('commission_pct', '10');
  setSetting('pro_price', '9990');
  setSetting('featured_price', '4990');

  const insRegion = db.prepare('INSERT INTO regions(name,code) VALUES(?,?)');
  const insComuna = db.prepare('INSERT INTO comunas(region_id,name,lat,lng) VALUES(?,?,?,?)');
  const regiones = [
    ['Arica y Parinacota','XV'], ['Tarapacá','I'], ['Antofagasta','II'], ['Atacama','III'],
    ['Coquimbo','IV'], ['Valparaíso','V'], ["O'Higgins",'VI'], ['Maule','VII'],
    ['Ñuble','XVI'], ['Biobío','VIII'], ['La Araucanía','IX'], ['Los Ríos','XIV'],
    ['Los Lagos','X'], ['Aysén','XI'], ['Magallanes','XII'], ['Metropolitana','RM']
  ];
  const regionIds = {};
  for (const [name, code] of regiones) regionIds[name] = insRegion.run(name, code).lastInsertRowid;

  const comunasData = [
    // Metropolitana
    ['Metropolitana','Santiago',-33.4489,-70.6693], ['Metropolitana','Providencia',-33.4314,-70.6090],
    ['Metropolitana','Las Condes',-33.4086,-70.5674], ['Metropolitana','Ñuñoa',-33.4544,-70.5978],
    ['Metropolitana','Maipú',-33.5116,-70.7571], ['Metropolitana','Puente Alto',-33.6117,-70.5758],
    ['Metropolitana','La Florida',-33.5226,-70.5996], ['Metropolitana','San Bernardo',-33.5923,-70.6996],
    ['Metropolitana','Peñalolén',-33.4766,-70.5417], ['Metropolitana','Vitacura',-33.3830,-70.5728],
    ['Metropolitana','Huechuraba',-33.3760,-70.6360], ['Metropolitana','Quilicura',-33.3670,-70.7310],
    ['Metropolitana','Recoleta',-33.4020,-70.6410], ['Metropolitana','Independencia',-33.4230,-70.6550],
    ['Metropolitana','Macul',-33.4820,-70.5990], ['Metropolitana','Pudahuel',-33.4420,-70.7500],
    ['Metropolitana','Estación Central',-33.4530,-70.6790], ['Metropolitana','Cerro Navia',-33.4230,-70.7420],
    ['Metropolitana','Lo Prado',-33.4440,-70.7220], ['Metropolitana','Buin',-33.7330,-70.7420],
    // Valparaíso
    ['Valparaíso','Valparaíso',-33.0472,-71.6127], ['Valparaíso','Viña del Mar',-33.0245,-71.5518],
    ['Valparaíso','Quilpué',-33.0470,-71.4420], ['Valparaíso','Villa Alemana',-33.0420,-71.3730],
    ['Valparaíso','Concón',-32.9220,-71.5150], ['Valparaíso','Quillota',-32.8830,-71.2480],
    // O'Higgins
    ["O'Higgins",'Rancagua',-34.1708,-70.7444], ["O'Higgins",'San Fernando',-34.5860,-70.9890],
    ["O'Higgins",'Rengo',-34.4060,-70.8580], ["O'Higgins",'Machalí',-34.1830,-70.6500],
    // Maule
    ['Maule','Talca',-35.4264,-71.6554], ['Maule','Curicó',-34.9840,-71.2390],
    ['Maule','Linares',-35.8460,-71.5930], ['Maule','Constitución',-35.3330,-72.4130],
  ];
  const comunaIds = {};
  for (const [r, c, lat, lng] of comunasData) comunaIds[c] = insComuna.run(regionIds[r], c, lat, lng).lastInsertRowid;

  const insCat = db.prepare('INSERT INTO categories(name,icon) VALUES(?,?)');
  const categorias = [
    ['Gasfíter','🔧'], ['Electricista','⚡'], ['Pintura','🎨'], ['Construcción','🧱'],
    ['Limpieza','🧹'], ['Jardinería','🌳'], ['Tecnología','💻'], ['Mecánica','🚗'],
    ['Cerrajería','🔑'], ['Otros servicios','➕']
  ];
  const catIds = {};
  for (const [n, i] of categorias) catIds[n] = insCat.run(n, i).lastInsertRowid;

  const insUser = db.prepare('INSERT INTO users(email,password_hash,name,phone,role,comuna_id,is_demo) VALUES(?,?,?,?,?,?,1)');
  const insWorker = db.prepare(`INSERT INTO worker_profiles
    (user_id,oficio,description,years_experience,price_from,status,comuna_id,verified_identity,verified_phone,is_recommended,is_pro,is_featured,jobs_completed,rating_avg,rating_count,response_rate,completion_rate,member_since,avatar_color)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insWC = db.prepare('INSERT INTO worker_categories(worker_id,category_id) VALUES(?,?)');
  const insWCom = db.prepare('INSERT INTO worker_comunas(worker_id,comuna_id) VALUES(?,?)');
  const insPort = db.prepare('INSERT INTO portfolio_images(worker_id,emoji,caption) VALUES(?,?,?)');

  // Cuentas DEMO
  const demoPass = hashPassword('demo1234');
  const clienteDemo = insUser.run('cliente@demo.cl', demoPass, 'María González (DEMO)', '+56912340001', 'cliente', comunaIds['Ñuñoa']).lastInsertRowid;
  const trabUserDemo = insUser.run('trabajador@demo.cl', demoPass, 'Carlos Fuentes (DEMO)', '+56912340002', 'trabajador', comunaIds['Ñuñoa']).lastInsertRowid;
  const adminDemo = insUser.run('admin@demo.cl', demoPass, 'Administrador DatoYa (DEMO)', '+56912340003', 'admin', comunaIds['Santiago']).lastInsertRowid;

  const colores = ['#1D4ED8','#0E7490','#B45309','#047857','#7C3AED','#BE185D','#374151','#9A3412','#065F46','#1E40AF'];
  const workerDemoId = insWorker.run(trabUserDemo, 'Gasfíter certificado',
    'Gasfíter con más de 10 años de experiencia. Instalaciones, reparaciones, fugas de agua y gas. Trabajo garantizado y con boleta. Atiendo toda la comuna de Ñuñoa y alrededores.',
    10, 25000, 'disponible', comunaIds['Ñuñoa'], 1, 1, 1, 1, 1, 128, 4.9, 86, 98, 99, '2023-03-15', colores[0]).lastInsertRowid;
  insWC.run(workerDemoId, catIds['Gasfíter']);
  for (const c of ['Ñuñoa','Providencia','Macul','Santiago','Peñalolén','La Florida']) insWCom.run(workerDemoId, comunaIds[c]);
  insPort.run(workerDemoId, '🚿', 'Instalación de calefont');
  insPort.run(workerDemoId, '🔧', 'Reparación de fuga en cocina');
  insPort.run(workerDemoId, '🚽', 'Cambio de WC completo');
  db.prepare('INSERT INTO subscriptions(worker_id,plan,status) VALUES(?,?,?)').run(workerDemoId, 'PRO', 'activa');

  const trabajadores = [
    ['Pedro Soto','gasfiter1@demo.cl','Gasfíter','Reparaciones de emergencia las 24 horas. Fugas, alcantarillado, instalación de agua caliente.',8,20000,'disponible','Providencia',['Providencia','Santiago','Vitacura','Recoleta'],['Gasfíter'],74,4.7,51,'2022-06-01',[1,1,0,0,0],['🚰 Instalación de grifería','🔧 Destape de alcantarilla']],
    ['Ana Rojas','electrica1@demo.cl','Electricista','Electricista certificada SEC. Instalaciones domiciliarias, tableros, iluminación LED y automatización.',6,30000,'disponible','Las Condes',['Las Condes','Vitacura','Providencia','Ñuñoa'],['Electricista'],92,4.8,63,'2021-11-20',[1,1,1,0,1],['💡 Instalación LED','🔌 Nuevo tablero eléctrico']],
    ['Jorge Muñoz','electrico2@demo.cl','Electricista','Empalmes, aumento de potencia, certificación TE1. Presupuesto sin costo.',12,25000,'ocupado','Puente Alto',['Puente Alto','La Florida','San Bernardo','Buin'],['Electricista'],156,4.6,110,'2020-02-10',[1,1,0,0,0],['🔌 Empalme nuevo','💡 Iluminación jardín']],
    ['Luis Parra','pintor1@demo.cl','Pintor','Pintura interior y exterior. Estuco, esmalte al agua y al óleo. Limpieza garantizada al terminar.',9,18000,'disponible','Maipú',['Maipú','Pudahuel','Estación Central','Cerro Navia'],['Pintura'],134,4.8,89,'2019-08-05',[1,1,1,1,1],['🎨 Casa completa 120m²','🖌️ Estuco y pintura living']],
    ['Rosa Díaz','pintora1@demo.cl','Pintora','Especialista en restauración de fachadas y pintura decorativa.',5,20000,'disponible','Viña del Mar',['Viña del Mar','Valparaíso','Concón','Quilpué'],['Pintura'],48,4.9,33,'2023-01-12',[1,0,0,0,0],['🎨 Fachada restaurada','🖌️ Mural decorativo']],
    ['Manuel Reyes','maestro1@demo.cl','Maestro de construcción','Ampliaciones, radieres, tabiquería y techumbre. Cuadrilla propia. Presupuestos con detalle.',15,50000,'disponible','San Bernardo',['San Bernardo','Buin','Puente Alto','La Florida'],['Construcción'],87,4.7,58,'2018-05-22',[1,1,1,0,0],['🧱 Ampliación 30m²','🏠 Radier y techumbre']],
    ['Carolina Vega','maestra1@demo.cl','Constructora','Obras menores, remodelación de baños y cocinas. Materializamos tu proyecto.',7,45000,'ocupado','Rancagua',['Rancagua','Machalí','Rengo'],['Construcción'],63,4.8,44,'2021-04-18',[1,1,0,0,0],['🛁 Remodelación baño','🧱 Tabiquería drywall']],
    ['José Lagos','limpieza1@demo.cl','Servicios de limpieza','Limpieza profunda de casas, oficinas y post-obra. Insumos incluidos.',4,25000,'disponible','Santiago',['Santiago','Estación Central','Recoleta','Independencia'],['Limpieza'],201,4.9,143,'2022-09-01',[0,1,0,0,0],['🧹 Limpieza profunda','✨ Post-obra brillante']],
    ['María José Campos','limpieza2@demo.cl','Limpieza y aseo','Aseo por horas, planes semanales. Personal de confianza con experiencia.',6,18000,'disponible','Ñuñoa',['Ñuñoa','Macul','La Florida','Peñalolén'],['Limpieza'],178,4.8,120,'2020-10-30',[1,1,1,0,0],['🧹 Aseo semanal','✨ Limpieza de ventanas']],
    ['Roberto Fica','jardinero1@demo.cl','Jardinero','Diseño y mantención de jardines, corte de pasto, poda de árboles y riego automático.',11,22000,'disponible','Vitacura',['Vitacura','Las Condes','Providencia','Huechuraba'],['Jardinería'],95,4.7,67,'2019-03-14',[1,1,0,1,0],['🌳 Poda de palmeras','🌿 Jardín nuevo 50m²']],
    ['Daniela Pinto','jardinera1@demo.cl','Jardinera paisajista','Paisajismo, terrazas verdes y huertos urbanos. Primera visita de evaluación gratis.',5,30000,'no_disponible','Concón',['Concón','Viña del Mar','Quilpué'],['Jardinería'],52,4.9,38,'2022-02-28',[1,1,0,0,0],['🌿 Terraza verde','🌱 Huerto urbano']],
    ['Felipe Araya','tecnopc1@demo.cl','Técnico en computación','Reparación de PC y notebooks, formateo, respaldo de datos, redes WiFi hogar y oficina.',8,15000,'disponible','Santiago',['Santiago','Providencia','Ñuñoa','Macul','Recoleta'],['Tecnología'],167,4.9,118,'2020-07-07',[1,1,1,1,1],['💻 Notebook reparado','🖥️ Armado PC gamer']],
    ['Valentina Cruz','tecnocel1@demo.cl','Técnica en celulares','Cambio de pantalla y batería, recuperación de equipos mojados. Garantía de 3 meses.',4,12000,'disponible','Valparaíso',['Valparaíso','Viña del Mar','Quilpué'],['Tecnología'],143,4.8,97,'2022-04-25',[1,1,0,0,0],['📱 Pantalla iPhone','🔋 Cambio de batería']],
    ['Héctor Salinas','mecanico1@demo.cl','Mecánico automotriz','Mecánica general, frenos, suspensión y mantenciones preventivas. A domicilio en la RM.',16,35000,'disponible','Puente Alto',['Puente Alto','La Florida','San Bernardo','Ñuñoa'],['Mecánica'],212,4.7,151,'2017-12-01',[1,1,1,0,0],['🚗 Cambio de frenos','🔧 Mantención 10.000 km']],
    ['Patricio Neira','mecanico2@demo.cl','Mecánico','Escáner computacional, correas de distribución, embrague. Trabajo con repuestos originales o alternativos, tú eliges.',10,30000,'ocupado','Talca',['Talca','Curicó','Linares'],['Mecánica'],98,4.6,70,'2019-06-19',[1,1,0,0,0],['🚗 Correa de distribución','🔧 Diagnóstico escáner']],
    ['Cristian Tapia','cerrajero1@demo.cl','Cerrajero 24 hrs','Apertura de puertas, cambio de cerraduras y cilindros. Urgencias toda la noche.',7,20000,'disponible','Santiago',['Santiago','Providencia','Ñuñoa','Independencia','Recoleta','Estación Central'],['Cerrajería'],189,4.8,132,'2020-01-08',[1,1,1,0,0],['🔑 Apertura sin daño','🔒 Cerradura de seguridad']],
    ['Sandra Morales','cerrajera1@demo.cl','Cerrajera','Cerraduras digitales, copias de llaves especiales, cerrojos de alta seguridad.',5,22000,'disponible','Rancagua',["Rancagua","Machalí","Rengo"],['Cerrajería'],76,4.9,54,'2021-08-15',[1,1,0,0,0],['🔑 Cerradura digital','🔒 Cerrojo instalado']],
    ['Tomás Herrera','gasfiter2@demo.cl','Gasfíter','Especialista en calefacción y termas solares. Instalación y mantención.',13,28000,'disponible','Talca',['Talca','Curicó','Linares','Constitución'],['Gasfíter'],119,4.7,84,'2018-10-02',[1,1,0,0,0],['🚿 Terma solar','🔥 Calefactor instalado']],
    ['Camila Fuentes','multi1@demo.cl','Gasfítera y electricista','Soluciones integrales para el hogar: agua, gas y electricidad. Certificada SEC.',9,27000,'disponible','Providencia',['Providencia','Ñuñoa','Las Condes','Vitacura'],['Gasfíter','Electricista'],88,4.9,61,'2020-11-11',[1,1,1,1,0],['🚿 Baño completo','💡 Revisión eléctrica']],
    ['Andrés Sáez','limpieza3@demo.cl','Limpieza industrial','Limpieza de bodegas, vidrieras en altura y alfombras. Equipo propio.',8,40000,'disponible','Quilicura',['Quilicura','Huechuraba','Pudahuel','Recoleta'],['Limpieza'],67,4.6,45,'2021-03-03',[0,1,0,0,0],['🧹 Bodega 500m²','✨ Vidrieras en altura']],
  ];

  const workerIds = [workerDemoId];
  const workerUserIds = [trabUserDemo];
  for (let i = 0; i < trabajadores.length; i++) {
    const [nombre, email, oficio, desc, anos, precio, estado, comuna, comunas, cats, trabajos, rating, resenas, desde, flags, port] = trabajadores[i];
    const uid = insUser.run(email, demoPass, nombre + ' (DEMO)', '+5691234' + String(1000 + i), 'trabajador', comunaIds[comuna]).lastInsertRowid;
    const wid = insWorker.run(uid, oficio, desc, anos, precio, estado, comunaIds[comuna], ...flags, trabajos, rating, resenas, 90 + (i % 10), 94 + (i % 6), desde, colores[i % colores.length]).lastInsertRowid;
    for (const c of cats) insWC.run(wid, catIds[c]);
    for (const c of comunas) if (comunaIds[c]) insWCom.run(wid, comunaIds[c]);
    for (const p of port) {
      const [emojiCap] = [p.split(' ')];
      insPort.run(wid, p.slice(0, 2).trim(), p.slice(2).trim());
    }
    workerIds.push(wid);
    workerUserIds.push(uid);
  }

  // Clientes DEMO adicionales (para reseñas)
  const nombresClientes = ['Francisca Mora','Rodrigo Paredes','Javiera Orellana','Matías Contreras','Constanza Ríos','Sebastián Araya','Paula Espinoza','Ignacio Bravo'];
  const clienteIds = [clienteDemo];
  for (let i = 0; i < nombresClientes.length; i++) {
    const coms = ['Ñuñoa','Providencia','Santiago','Maipú','La Florida','Rancagua','Viña del Mar','Talca'];
    clienteIds.push(insUser.run(`cliente${i+1}@demo.cl`, demoPass, nombresClientes[i] + ' (DEMO)', '+5699876' + String(1000 + i), 'cliente', comunaIds[coms[i]]).lastInsertRowid);
  }

  // Trabajos históricos + reseñas DEMO
  const comentarios = [
    'Excelente trabajo, muy puntual y ordenado. Lo recomiendo totalmente.',
    'Buen servicio, llegó a la hora acordada y dejó todo funcionando.',
    'Muy profesional, explicó todo el proceso. Precio justo.',
    'Trabajo rápido y limpio. Volvería a contratarlo.',
    'Cumplió con lo prometido, aunque se atrasó un poco.',
    'Impecable, se nota la experiencia. Cinco estrellas.',
    'Buena disposición y muy buen precio comparado con otros.',
  ];
  const insJob = db.prepare(`INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount,created_at,updated_at) VALUES(?,?,?,?,'FINALIZADO',?,?,?,?,?,?)`);
  const insHist = db.prepare('INSERT INTO job_status_history(job_id,status,changed_by,created_at) VALUES(?,?,?,?)');
  const insRev = db.prepare(`INSERT INTO reviews(job_id,reviewer_id,reviewee_id,direction,rating,quality,punctuality,treatment,price_rating,comment,is_demo,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?)`);
  const insPay = db.prepare(`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status,created_at) VALUES(?,?,?,?,'tarjeta','DEMO','demo_completado',?)`);
  const insCom = db.prepare('INSERT INTO commissions(job_id,pct,amount,created_at) VALUES(?,?,?,?)');
  const insReq = db.prepare(`INSERT INTO service_requests(client_id,category_id,title,description,comuna_id,urgency,budget,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)`);
  const insQuote = db.prepare(`INSERT INTO quotes(request_id,worker_id,price,description,available_date,duration_estimate,materials_included,comment,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  const insConv = db.prepare('INSERT OR IGNORE INTO conversations(request_id,job_id,client_id,worker_id) VALUES(?,?,?,?)');
  const insMsg = db.prepare('INSERT INTO messages(conversation_id,sender_id,body,blocked,read_at,created_at) VALUES(?,?,?,?,?,?)');

  let jobCount = 0;
  for (let w = 0; w < workerIds.length && jobCount < 12; w++) {
    const nJobs = w === 0 ? 2 : 1;
    for (let j = 0; j < nJobs && jobCount < 12; j++) {
      jobCount++;
      const cliId = clienteIds[(jobCount) % clienteIds.length];
      const precio = 25000 + (jobCount * 7000);
      const fecha = `2026-0${(jobCount % 8) + 1}-1${jobCount % 9} 10:00:00`;
      const reqId = insReq.run(cliId, catIds['Gasfíter'], `Trabajo demo #${jobCount}`, 'Trabajo histórico de demostración.', comunaIds['Ñuñoa'], 'elegir_fecha', precio, 'cerrada', fecha).lastInsertRowid;
      const qId = insQuote.run(reqId, workerIds[w], precio, 'Cotización de trabajo histórico demo.', '2026-01-15', '1 día', 1, '', 'aceptada', fecha).lastInsertRowid;
      const com = Math.round(precio * 0.10);
      const jobId = insJob.run(reqId, qId, cliId, workerIds[w], precio, 10, com, precio - com, fecha, fecha).lastInsertRowid;
      for (const st of ['SOLICITADO','COTIZANDO','TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','FINALIZADO']) insHist.run(jobId, st, cliId, fecha);
      const rating = 4 + (jobCount % 2);
      insRev.run(jobId, cliId, workerUserIds[w], 'cliente_a_trabajador', rating, rating, rating, 5, rating, comentarios[jobCount % comentarios.length], fecha);
      insPay.run(jobId, precio, com, precio - com, fecha);
      insCom.run(jobId, 10, com, fecha);
    }
  }

  // Solicitudes abiertas DEMO
  const sol1 = insReq.run(clienteIds[1], catIds['Gasfíter'], 'Fuga de agua en cocina', 'Tengo una fuga bajo el lavaplatos, gotea constante y ya mojó el mueble. Necesito que lo revisen pronto. (Solicitud DEMO)', comunaIds['Providencia'], 'hoy', 40000, 'abierta', '2026-09-07 09:30:00').lastInsertRowid;
  const sol2 = insReq.run(clienteIds[2], catIds['Electricista'], 'Instalar lámparas en living', 'Compré 3 lámparas colgantes y necesito instalarlas. El techo es de yeso. (Solicitud DEMO)', comunaIds['Las Condes'], 'elegir_fecha', 60000, 'abierta', '2026-09-07 15:12:00').lastInsertRowid;
  insReq.run(clienteIds[3], catIds['Pintura'], 'Pintar dormitorio 12m²', 'Quiero pintar un dormitorio, murallas en buen estado, solo cambio de color. Yo compro la pintura. (Solicitud DEMO)', comunaIds['Maipú'], 'manana', 50000, 'abierta', '2026-09-08 08:05:00');

  // Cotizaciones DEMO en sol1
  insQuote.run(sol1, workerDemoId, 45000, 'Revisión de la fuga, cambio de flexible y sellado. Incluye materiales menores.', '2026-09-09', '2 horas aprox.', 1, 'Puedo ir mañana en la mañana sin problema.', 'pendiente', '2026-09-07 11:00:00');
  insQuote.run(sol1, workerIds[1], 40000, 'Reparación de fuga, garantía de 30 días. Materiales no incluidos (aprox. $8.000).', '2026-09-08', '1-2 horas', 0, 'Hoy en la tarde puedo pasar a verlo.', 'pendiente', '2026-09-07 12:15:00');
  insQuote.run(sol2, workerIds[2], 55000, 'Instalación de 3 lámparas colgantes en techo de yeso, incluye tarugos y materiales de fijación.', '2026-09-10', 'Medio día', 1, '', 'pendiente', '2026-09-07 18:40:00');

  // Conversación DEMO
  const convId = insConv.run(sol1, null, clienteIds[1], workerDemoId).lastInsertRowid;
  insMsg.run(convId, clienteIds[1], 'Hola Carlos, ¿la cotización incluye el cambio del flexible completo?', 0, '2026-09-07 11:20:00', '2026-09-07 11:18:00');
  insMsg.run(convId, trabUserDemo, 'Hola, sí, incluye el flexible nuevo y el sellado. Si hay que cambiar algo más te aviso antes.', 0, '2026-09-07 11:25:00', '2026-09-07 11:22:00');
  insMsg.run(convId, clienteIds[1], 'Perfecto, ¿a qué hora podrías venir?', 0, null, '2026-09-07 11:26:00');

  // Denuncia DEMO
  db.prepare(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details,status) VALUES(?,?,?,?,?,?)`)
    .run(clienteIds[4], 'usuario', workerUserIds[5], 'incumplimiento', 'El trabajador no llegó a la hora acordada y no respondió los mensajes. (Denuncia DEMO)', 'pendiente');

  // Solicitud de verificación DEMO pendiente
  db.prepare(`INSERT INTO verification_requests(worker_id,type,status) VALUES(?,?,?)`).run(workerIds[3], 'identidad', 'pendiente');

  // Notificaciones DEMO
  notify(clienteDemo, 'cotizacion', 'Recibiste una nueva cotización para tu solicitud (DEMO).', '#/solicitudes');
  notify(trabUserDemo, 'solicitud', 'Hay una nueva solicitud de Gasfíter cerca de ti (DEMO).', '#/bandeja');

  console.log('[DatoYa] Datos DEMO listos.');
}

module.exports = { db, hashPassword, verifyPassword, getSetting, setSetting, notify, seed };

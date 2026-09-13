// DatoYa 2.0 — runtime DEMO. Idempotente y compatible con el esquema actual.
const { db, hashPassword } = require('./db');

const DEMO_PASSWORD = 'demo1234';

function region(name, code) {
  let r = db.prepare('SELECT id FROM regions WHERE name=?').get(name);
  if (!r) r = db.prepare('INSERT INTO regions(name,code) VALUES(?,?)').run(name, code);
  return r.id || r.lastInsertRowid;
}
function comuna(name, regionName='Metropolitana', code='RM') {
  const rid = region(regionName, code);
  let c = db.prepare('SELECT id FROM comunas WHERE name=?').get(name);
  if (!c) c = db.prepare('INSERT INTO comunas(region_id,name) VALUES(?,?)').run(rid, name);
  return c.id || c.lastInsertRowid;
}
function category(name, icon='🔧') {
  let c = db.prepare('SELECT id FROM categories WHERE name=?').get(name);
  if (!c) c = db.prepare('INSERT INTO categories(name,icon) VALUES(?,?)').run(name, icon);
  return c.id || c.lastInsertRowid;
}
function demoUser(email, name, role, comunaName='Santiago', regionName='Metropolitana', code='RM') {
  const cid = comuna(comunaName, regionName, code);
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (!existing) return db.prepare('INSERT INTO users(email,password_hash,name,role,comuna_id,is_active,is_demo) VALUES(?,?,?,?,?,1,1)').run(email,hashPassword(DEMO_PASSWORD),name,role,cid).lastInsertRowid;
  db.prepare('UPDATE users SET password_hash=?,name=?,role=?,comuna_id=?,is_active=1,is_demo=1 WHERE id=?').run(hashPassword(DEMO_PASSWORD),name,role,cid,existing.id);
  return existing.id;
}
function workerProfile(userId, oficio, comunaId, opts={}) {
  let p = db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(userId);
  if (!p) p = db.prepare(`INSERT INTO worker_profiles(user_id,oficio,description,years_experience,price_from,status,comuna_id,verified_identity,verified_phone,is_recommended,is_pro,is_featured,jobs_completed,rating_avg,rating_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId,oficio,'Profesional DEMO para pruebas de DatoYa.',opts.years||5,opts.price||25000,'disponible',comunaId,opts.verified?1:0,opts.verified?1:0,opts.recommended?1:0,opts.pro?1:0,opts.featured?1:0,opts.jobs||0,opts.rating||4.7,opts.count||30);
  return p.id || p.lastInsertRowid;
}

// Catálogo mínimo estable para CI y DEMO.
[['Gasfíter','🔧'],['Electricista','⚡'],['Pintura','🎨'],['Construcción','🧱'],['Limpieza','🧹'],['Jardinería','🌳'],['Tecnología','💻'],['Mecánica','🚗'],['Cerrajería','🔑'],['Mudanzas','📦']].forEach(x=>category(x[0],x[1]));
['Santiago','Providencia','Las Condes','Ñuñoa','Maipú','Puente Alto','La Florida','San Bernardo','Peñalolén','Vitacura','Huechuraba','Quilicura','Recoleta','Independencia','Macul','Pudahuel','Estación Central','Cerro Navia','Lo Prado','Buin'].forEach(n=>comuna(n));
['Rancagua','San Fernando','Rengo','Machalí'].forEach(n=>comuna(n,"O'Higgins",'VI'));
['Valparaíso','Viña del Mar','Quilpué','Villa Alemana','Concón','Quillota'].forEach(n=>comuna(n,'Valparaíso','V'));
['Talca','Curicó','Linares','Constitución'].forEach(n=>comuna(n,'Maule','VII'));

const admin = demoUser('admin@demo.cl','Administrador DatoYa (DEMO)','admin');
const client = demoUser('cliente@demo.cl','María González (DEMO)','cliente','Rancagua',"O'Higgins",'VI');
const don = demoUser('donchichi@demo.cl','Don Chichi','cliente','Rancagua',"O'Higgins",'VI');
const worker = demoUser('trabajador@demo.cl','Carlos Fuentes (DEMO)','trabajador','Rancagua',"O'Higgins",'VI');

const gas = category('Gasfíter','🔧');
const wp = workerProfile(worker,'Gasfíter',comuna('Rancagua',"O'Higgins",'VI'),{verified:true,recommended:true,pro:true,featured:true,jobs:72,rating:4.8,count:45});
db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(wp,gas);

const pros = [
 ['Miguel Araya (DEMO)','gasfiter2@demo.cl','Gasfíter','Rancagua',"O'Higgins",'VI',1,1,1,128,4.9],
 ['Daniela Rojas (DEMO)','electricista.demo2@demo.cl','Electricista','Santiago','Metropolitana','RM',1,1,0,94,4.8],
 ['Luis Herrera (DEMO)','pintor.demo2@demo.cl','Pintura','Maipú','Metropolitana','RM',1,0,1,76,4.7],
 ['Jorge Ramírez (DEMO)','constructor.demo2@demo.cl','Construcción','San Bernardo','Metropolitana','RM',1,1,1,143,4.9],
 ['Paula González (DEMO)','limpieza.demo2@demo.cl','Limpieza','Ñuñoa','Metropolitana','RM',0,1,0,87,4.8],
 ['Roberto Silva (DEMO)','jardinero.demo2@demo.cl','Jardinería','Rancagua',"O'Higgins",'VI',1,0,0,112,4.6]
];
for (const [name,email,oficio,com,rn,rc,verified,pro,featured,jobs,rating] of pros) {
  const uid = demoUser(email,name,'trabajador',com,rn,rc);
  const cid = category(oficio);
  const id = workerProfile(uid,oficio,comuna(com,rn,rc),{verified,pro,featured,jobs,rating,count:Math.max(20,Math.round(jobs*.55))});
  db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(id,cid);
}

// Flujo DEMO cliente → solicitud → cotización → trabajo.
const requestTitle = 'Instalación de calefont DEMO';
let request = db.prepare("SELECT id FROM service_requests WHERE client_id=? AND title=? LIMIT 1").get(don,requestTitle);
if (!request) request = db.prepare('INSERT INTO service_requests(client_id,category_id,title,description,comuna_id,budget,status) VALUES(?,?,?,?,?,?,?)').run(don,gas,requestTitle,'Solicitud ficticia para probar cotizaciones y ganancias.',comuna('Rancagua',"O'Higgins",'VI'),120000,'cerrada');
const requestId = request.id || request.lastInsertRowid;
let quote = db.prepare('SELECT id FROM quotes WHERE request_id=? LIMIT 1').get(requestId);
if (!quote) quote = db.prepare("INSERT INTO quotes(request_id,worker_id,price,description,status) VALUES(?,?,?,?,?)").run(requestId,wp,120000,'Trabajo DEMO completado.','aceptada');
const quoteId = quote.id || quote.lastInsertRowid;
let job = db.prepare('SELECT id FROM jobs WHERE request_id=? LIMIT 1').get(requestId);
if (!job) job = db.prepare('INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount) VALUES(?,?,?,?,?,?,?,?,?)').run(requestId,quoteId,don,wp,'FINALIZADO',120000,10,12000,108000);
const jobId = job.id || job.lastInsertRowid;

function payment(amount) {
  const commission = Math.round(amount*0.10);
  const exists = db.prepare("SELECT id FROM payments WHERE job_id=? AND amount=? AND provider='DEMO'").get(jobId,amount);
  if (!exists) {
    db.prepare('INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,?,?,?)').run(jobId,amount,commission,amount-commission,'tarjeta','DEMO','demo_completado');
    db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(jobId,10,commission);
  }
}
[120000,85000,150000,65000,210000,95000,175000,130000].forEach(payment);

// Retiros ficticios y estados de verificación/suscripción.
for (const row of db.prepare('SELECT id FROM worker_profiles ORDER BY id LIMIT 3').all()) {
  if (!db.prepare("SELECT id FROM payout_requests WHERE worker_id=? AND amount=45000 AND status='pagado'").get(row.id)) db.prepare("INSERT INTO payout_requests(worker_id,amount,status) VALUES(?,?,?)").run(row.id,45000,'pagado');
}
if (!db.prepare("SELECT id FROM subscriptions WHERE worker_id=? AND status='activa'").get(wp)) db.prepare("INSERT INTO subscriptions(worker_id,plan,status) VALUES(?,?,?)").run(wp,'PRO','activa');
if (!db.prepare("SELECT id FROM verification_requests WHERE worker_id=? AND status='pendiente'").get(wp)) db.prepare("INSERT INTO verification_requests(worker_id,type,status) VALUES(?,?,?)").run(wp,'identidad','pendiente');

// Expedientes de denuncias DEMO en ambos sentidos.
if (db.prepare('SELECT COUNT(*) c FROM reports').get().c === 0) {
  db.prepare("INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)").run(don,'usuario',worker,'Problema con profesional DEMO','Expediente ficticio: Cliente → Profesional.');
  db.prepare("INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)").run(worker,'usuario',don,'Conducta del cliente DEMO','Expediente ficticio: Profesional → Cliente.');
}

console.log('[DatoYa] Runtime DEMO listo: catálogo, usuarios, profesionales, flujo, ganancias, retiros y denuncias.');

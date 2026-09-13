// DatoYa 2.0 — seed idempotente para DEMO de administración.
const {db,hashPassword}=require('./db');

function region(name,code){let r=db.prepare('SELECT id FROM regions WHERE name=?').get(name);if(!r)r=db.prepare('INSERT INTO regions(name,code) VALUES(?,?)').run(name,code);return r.id||r.lastInsertRowid}
function comuna(name,regionName='Metropolitana',code='RM'){const rid=region(regionName,code);let c=db.prepare('SELECT id FROM comunas WHERE name=?').get(name);if(!c)c=db.prepare('INSERT INTO comunas(region_id,name) VALUES(?,?)').run(rid,name);return c.id||c.lastInsertRowid}
function cat(name,icon){let c=db.prepare('SELECT id FROM categories WHERE name=?').get(name);if(!c)c=db.prepare('INSERT INTO categories(name,icon) VALUES(?,?)').run(name,icon);return c.id||c.lastInsertRowid}
function user(email,name,role,comunaName='Santiago'){let u=db.prepare('SELECT id FROM users WHERE email=?').get(email);const cid=comuna(comunaName);if(!u){const id=db.prepare('INSERT INTO users(email,password_hash,name,role,comuna_id,is_demo) VALUES(?,?,?,?,?,1)').run(email,hashPassword('demo1234'),name,role,cid).lastInsertRowid;return id}db.prepare('UPDATE users SET password_hash=?,role=?,is_active=1,is_demo=1,comuna_id=? WHERE id=?').run(hashPassword('demo1234'),role,cid,u.id);return u.id}

// Catálogos mínimos/completos usados por la app DEMO.
[['Gasfíter','🔧'],['Electricista','⚡'],['Pintura','🎨'],['Construcción','🧱'],['Limpieza','🧹'],['Jardinería','🌳'],['Tecnología','💻'],['Mecánica','🚗'],['Cerrajería','🔑'],['Mudanzas','📦']].forEach(x=>cat(...x));
['Santiago','Providencia','Las Condes','Ñuñoa','Maipú','Puente Alto','La Florida','San Bernardo','Peñalolén','Vitacura','Huechuraba','Quilicura','Recoleta','Independencia','Macul','Pudahuel','Estación Central','Cerro Navia','Lo Prado','Buin'].forEach(x=>comuna(x));
['Rancagua','San Fernando','Rengo','Machalí'].forEach(x=>comuna(x,"O'Higgins",'VI'));
['Valparaíso','Viña del Mar','Quilpué','Villa Alemana','Concón','Quillota'].forEach(x=>comuna(x,'Valparaíso','V'));
['Talca','Curicó','Linares','Constitución'].forEach(x=>comuna(x,'Maule','VII'));

const admin=user('admin@demo.cl','Administrador DatoYa (DEMO)','admin');
const client=user('cliente@demo.cl','María González (DEMO)','cliente','Rancagua');
const don=user('donchichi@demo.cl','Don Chichi','cliente','Rancagua');
const workerUser=user('trabajador@demo.cl','Carlos Fuentes (DEMO)','trabajador','Rancagua');
const gas=cat('Gasfíter','🔧');
let wp=db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(workerUser);
if(!wp)wp=db.prepare(`INSERT INTO worker_profiles(user_id,oficio,description,years_experience,price_from,status,comuna_id,verified_identity,verified_phone,is_recommended,is_pro,is_featured,jobs_completed,rating_avg,rating_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(workerUser,'Gasfíter','Profesional DEMO para mostrar el flujo completo.',8,25000,'disponible',comuna('Rancagua',"O'Higgins",'VI'),1,1,1,1,1,72,4.8,45);wp={id:wp.id||wp.lastInsertRowid};
db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(wp.id,gas);

// Profesionales adicionales para el panel.
const pros=[['Miguel Araya (DEMO)','gasfiter2@demo.cl','Gasfíter','Rancagua',1,1,1,128,4.9],['Daniela Rojas (DEMO)','electricista.demo2@demo.cl','Electricista','Santiago',1,1,0,94,4.8],['Luis Herrera (DEMO)','pintor.demo2@demo.cl','Pintura','Maipú',1,0,1,76,4.7],['Jorge Ramírez (DEMO)','constructor.demo2@demo.cl','Construcción','San Bernardo',1,1,1,143,4.9],['Paula González (DEMO)','limpieza.demo2@demo.cl','Limpieza','Ñuñoa',0,1,0,87,4.8],['Roberto Silva (DEMO)','jardinero.demo2@demo.cl','Jardinería','Rancagua',1,0,0,112,4.6]];
for(const [name,email,oficio,com,ver,pro,feat,jobs,rating] of pros){const uid=user(email,name,'trabajador',com);let p=db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(uid);const cid=cat(oficio==='Pintura'?'Pintura':oficio==='Construcción'?'Construcción':oficio==='Limpieza'?'Limpieza':oficio==='Jardinería'?'Jardinería':oficio);if(!p)p=db.prepare(`INSERT INTO worker_profiles(user_id,oficio,description,years_experience,price_from,status,comuna_id,verified_identity,verified_phone,is_recommended,is_pro,is_featured,jobs_completed,rating_avg,rating_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,oficio,'Profesional DEMO para visualizar DatoYa.',5,25000,'disponible',comuna(com),ver,ver,rating>=4.8,pro,feat,jobs,rating,Math.max(20,Math.round(jobs*.55)));p={id:p.id||p.lastInsertRowid};db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(p.id,cid)}

// Datos financieros DEMO: nunca representan dinero real.
let req=db.prepare("SELECT id FROM service_requests WHERE client_id=? AND title='Instalación de calefont DEMO' LIMIT 1").get(don);if(!req)req=db.prepare(`INSERT INTO service_requests(client_id,category_id,title,description,comuna_id,budget,status,is_demo) VALUES(?,?,?,?,?,?,?)`).run(don,gas,'Instalación de calefont DEMO','Solicitud ficticia para mostrar ganancias, cotización y trabajo.',comuna('Rancagua',"O'Higgins",'VI'),120000,'cerrada',1).lastInsertRowid;else req=req.id;
let quote=db.prepare('SELECT id FROM quotes WHERE request_id=? LIMIT 1').get(req);if(!quote)quote=db.prepare(`INSERT INTO quotes(request_id,worker_id,price,description,status) VALUES(?,?,?,?,?)`).run(req,wp.id,120000,'Trabajo DEMO completado.','aceptada').lastInsertRowid;else quote=quote.id;
let job=db.prepare('SELECT id FROM jobs WHERE request_id=? LIMIT 1').get(req);if(!job)job=db.prepare(`INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount) VALUES(?,?,?,?,?,?,?,?,?)`).run(req,quote,don,wp.id,'FINALIZADO',120000,10,12000,108000).lastInsertRowid;else job=job.id;
if(!db.prepare('SELECT id FROM payments WHERE job_id=?').get(job))db.prepare(`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,?,?,?)`).run(job,120000,12000,108000,'tarjeta','DEMO','demo_completado');
if(!db.prepare('SELECT id FROM commissions WHERE job_id=?').get(job))db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job,10,12000);

// Más operaciones ficticias para que Ganancias no aparezca vacía.
const amounts=[[85000,8500],[150000,15000],[65000,6500],[210000,21000],[95000,9500]];for(const [gross,comm] of amounts){const exists=db.prepare('SELECT id FROM payments WHERE amount=? AND commission=? AND provider=\'DEMO\'').get(gross,comm);if(!exists){const q=db.prepare('SELECT id FROM jobs WHERE client_id=? LIMIT 1').get(don);db.prepare('INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,?,?,?)').run(q.id,gross,comm,gross-comm,'transfer','DEMO','demo_completado')}}

// Retiros, banco, PRO, verificación y denuncias para poblar el panel.
for(const p of db.prepare('SELECT id FROM worker_profiles LIMIT 3').all()){db.prepare('INSERT OR IGNORE INTO payout_requests(worker_id,amount,status) VALUES(?,?,?)').run(p.id,45000,'pagado')}
try{db.prepare('INSERT OR IGNORE INTO worker_bank_accounts(worker_id,bank_name,account_type,account_last4) VALUES(?,?,?,?)').run(wp.id,'BancoEstado','Cuenta RUT','4821')}catch(e){}
db.prepare("INSERT OR IGNORE INTO subscriptions(worker_id,plan,status,amount) VALUES(?,?,?,?)").run(wp.id,'MENSUAL','activa',9990);
if(db.prepare("SELECT COUNT(*) c FROM verification_requests WHERE status='pendiente'").get().c===0)db.prepare("INSERT INTO verification_requests(worker_id,type,status,document_type,ticket) VALUES(?,?,?,?,?)").run(wp.id,'identidad','pendiente','RUT','DEMO-VER-001');
if(db.prepare('SELECT COUNT(*) c FROM reports').get().c===0){db.prepare("INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)").run(don,'usuario',workerUser,'Problema con profesional DEMO','Caso ficticio para visualizar expediente Cliente → Profesional.');db.prepare("INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)").run(workerUser,'usuario',don,'Conducta del cliente DEMO','Caso ficticio para visualizar expediente Profesional → Cliente.')}

console.log('[DatoYa] Runtime DEMO completo: catalogos, usuarios, profesionales, ganancias y expedientes.');
const { db } = require('./db');
const bcrypt = require('bcryptjs');

function category(name){let r=db.prepare('SELECT id FROM categories WHERE name=?').get(name);if(!r)r={id:db.prepare('INSERT INTO categories(name) VALUES(?)').run(name).lastInsertRowid};return r.id;}
function comuna(name,regionName='Metropolitana de Santiago',roman='RM'){let r=db.prepare('SELECT c.id FROM comunas c JOIN regions r ON r.id=c.region_id WHERE c.name=? AND r.name=?').get(name,regionName);if(!r){let rg=db.prepare('SELECT id FROM regions WHERE name=?').get(regionName);if(!rg)rg={id:db.prepare('INSERT INTO regions(name,roman) VALUES(?,?)').run(regionName,roman).lastInsertRowid};r={id:db.prepare('INSERT INTO comunas(region_id,name) VALUES(?,?)').run(rg.id,name).lastInsertRowid};}return r.id;}
function demoUser(email,name,role,comunaName='Santiago',regionName='Metropolitana de Santiago',roman='RM'){
 let u=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(u)return u.id;
 return db.prepare('INSERT INTO users(email,password_hash,name,role,comuna_id,is_demo) VALUES(?,?,?,?,?,1)').run(email,bcrypt.hashSync('demo1234',10),name,role,comuna(comunaName,regionName,roman)).lastInsertRowid;
}
function workerProfile(userId,headline,comunaId,opt={}){
 let w=db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(userId);if(w)return w.id;
 return db.prepare('INSERT INTO worker_profiles(user_id,headline,bio,comuna_id,verified,pro,featured,jobs_completed,rating,rating_count) VALUES(?,?,?,?,?,?,?,?,?,?)').run(userId,headline,`Profesional DEMO de ${headline}.`,comunaId,opt.verified?1:0,opt.pro?1:0,opt.featured?1:0,opt.jobs||0,opt.rating||4.8,opt.count||20).lastInsertRowid;
}

const don=demoUser('cliente@demo.cl','Cliente DEMO','cliente','Rancagua',"O'Higgins",'VI');
const worker=demoUser('profesional@demo.cl','Profesional DEMO','trabajador','Rancagua',"O'Higgins",'VI');
const gas=category('Gasfitería');
const wp=workerProfile(worker,'Gasfiter certificado',comuna('Rancagua',"O'Higgins",'VI'),{verified:true,pro:true,featured:true,jobs:48,rating:4.9,count:31});
db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(wp,gas);

const demoWorkers=[
 ['electricista@demo.cl','Electricista DEMO','Electricidad','Santiago','Metropolitana de Santiago','RM',true,true,true,63,4.9],
 ['pintor@demo.cl','Pintor DEMO','Pintura','Providencia','Metropolitana de Santiago','RM',true,false,false,37,4.8],
 ['jardin@demo.cl','Jardinero DEMO','Jardinería','Las Condes','Metropolitana de Santiago','RM',false,false,false,22,4.7],
 ['aseo@demo.cl','Aseo DEMO','Aseo y Limpieza','Maipú','Metropolitana de Santiago','RM',true,true,false,54,4.9],
 ['tecnico@demo.cl','Técnico DEMO','Reparaciones','Viña del Mar','Valparaíso','V',true,false,true,41,4.8]
];
for(const [email,name,oficio,com,rn,rc,verified,pro,featured,jobs,rating] of demoWorkers){
 const uid=demoUser(email,name,'trabajador',com,rn,rc),cid=category(oficio),id=workerProfile(uid,oficio,comuna(com,rn,rc),{verified,pro,featured,jobs,rating,count:Math.max(20,Math.round(jobs*.55))});
 db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(id,cid);
}

// Flujo DEMO cliente → solicitud → cotización → trabajo.
const requestTitle='Instalación de calefont DEMO';
let request=db.prepare('SELECT id FROM service_requests WHERE client_id=? AND title=? LIMIT 1').get(don,requestTitle);
if(!request)request=db.prepare('INSERT INTO service_requests(client_id,category_id,title,description,comuna_id,budget,status) VALUES(?,?,?,?,?,?,?)').run(don,gas,requestTitle,'Solicitud ficticia para probar cotizaciones y ganancias.',comuna('Rancagua',"O'Higgins",'VI'),120000,'cerrada');
const requestId=request.id||request.lastInsertRowid;
let quote=db.prepare('SELECT id FROM quotes WHERE request_id=? LIMIT 1').get(requestId);
if(!quote)quote=db.prepare('INSERT INTO quotes(request_id,worker_id,price,description,status) VALUES(?,?,?,?,?)').run(requestId,wp,120000,'Trabajo DEMO completado.','aceptada');
const quoteId=quote.id||quote.lastInsertRowid;
let job=db.prepare('SELECT id FROM jobs WHERE request_id=? LIMIT 1').get(requestId);
if(!job)job=db.prepare('INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount) VALUES(?,?,?,?,?,?,?,?,?)').run(requestId,quoteId,don,wp,'FINALIZADO',120000,10,12000,108000);
const jobId=job.id||job.lastInsertRowid;

// La contabilidad real exige una sola fila de pago/comisión por trabajo.
function payment(amount){
 const commission=Math.round(amount*0.10);
 const exists=db.prepare('SELECT id FROM payments WHERE job_id=?').get(jobId);
 if(!exists){
  db.prepare('INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,?,?,?)').run(jobId,amount,commission,amount-commission,'tarjeta','DEMO','demo_completado');
  if(!db.prepare('SELECT id FROM commissions WHERE job_id=?').get(jobId))db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(jobId,10,commission);
 }
}
payment(120000);

// Retiros ficticios y estados de verificación/suscripción.
for(const row of db.prepare('SELECT id FROM worker_profiles ORDER BY id LIMIT 3').all()){
 if(!db.prepare("SELECT id FROM payout_requests WHERE worker_id=? AND amount=45000 AND status='pagado'").get(row.id))db.prepare("INSERT INTO payout_requests(worker_id,amount,status) VALUES(?,?,?)").run(row.id,45000,'pagado');
}
if(!db.prepare("SELECT id FROM subscriptions WHERE worker_id=? AND status='activa'").get(wp))db.prepare("INSERT INTO subscriptions(worker_id,plan,status) VALUES(?,?,?)").run(wp,'PRO','activa');
if(!db.prepare("SELECT id FROM verification_requests WHERE worker_id=? AND status='pendiente'").get(wp))db.prepare("INSERT INTO verification_requests(worker_id,type,status) VALUES(?,?,?)").run(wp,'identidad','pendiente');

// Expedientes de denuncias DEMO en ambos sentidos.
if(db.prepare('SELECT COUNT(*) c FROM reports').get().c===0){
 db.prepare('INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)').run(don,'usuario',worker,'Problema con profesional DEMO','Expediente ficticio: Cliente → Profesional.');
 db.prepare('INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)').run(worker,'usuario',don,'Conducta del cliente DEMO','Expediente ficticio: Profesional → Cliente.');
}

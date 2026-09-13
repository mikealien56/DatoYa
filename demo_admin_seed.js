// DatoYa — Datos DEMO adicionales para visualizar el panel administrativo.
// No borra ni modifica datos reales. Solo crea registros marcados is_demo=1 si no existen.
const { db, hashPassword } = require('./db');

function ensureUser({ email, name, role, phone, comuna }) {
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (exists) return exists.id;
  const comunaRow = db.prepare('SELECT id FROM comunas WHERE name=? LIMIT 1').get(comuna);
  return db.prepare(`INSERT INTO users(email,password_hash,name,phone,role,comuna_id,is_demo)
    VALUES(?,?,?,?,?,?,1)`).run(email, hashPassword('demo1234'), name, phone || null, role, comunaRow ? comunaRow.id : null).lastInsertRowid;
}

function ensureWorker(userId, data) {
  const exists = db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(userId);
  if (exists) return exists.id;
  const comuna = db.prepare('SELECT id FROM comunas WHERE name=? LIMIT 1').get(data.comuna);
  const workerId = db.prepare(`INSERT INTO worker_profiles
    (user_id,oficio,description,years_experience,price_from,status,comuna_id,verified_identity,verified_phone,is_recommended,is_pro,is_featured,jobs_completed,rating_avg,rating_count,response_rate,completion_rate,member_since)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(userId,data.oficio,data.description,data.years,data.price,data.status,comuna?.id || null,
      data.verified ? 1 : 0, data.phoneVerified ? 1 : 0, data.recommended ? 1 : 0,
      data.pro ? 1 : 0, data.featured ? 1 : 0, data.jobs, data.rating, data.ratingCount,
      data.response, data.completion, data.memberSince).lastInsertRowid;
  const category = db.prepare('SELECT id FROM categories WHERE name=? LIMIT 1').get(data.categoria);
  if (category) db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(workerId, category.id);
  return workerId;
}

// Clientes DEMO: uno de ellos se llama deliberadamente "Don Chichi" para la demostración.
[
  {email:'donchichi@demo.cl',name:'Don Chichi',role:'cliente',phone:'+56990000001',comuna:'Doñihue'},
  {email:'carolina.demo@demo.cl',name:'Carolina Martínez (DEMO)',role:'cliente',phone:'+56990000002',comuna:'Rancagua'},
  {email:'sebastian.demo@demo.cl',name:'Sebastián Pérez (DEMO)',role:'cliente',phone:'+56990000003',comuna:'Santiago'},
  {email:'valentina.demo@demo.cl',name:'Valentina Soto (DEMO)',role:'cliente',phone:'+56990000004',comuna:'Ñuñoa'},
].forEach(ensureUser);

const professionals = [
  ['gasfiter.demo@demo.cl','Miguel Araya (DEMO)','Gasfíter', 'Especialista en fugas, grifería, calefont y reparaciones domiciliarias.',10,25000,'disponible','Rancagua','Gasfíter',1,1,1,128,4.9,86,98,99,'2022-03-10'],
  ['electricista.demo@demo.cl','Daniela Rojas (DEMO)','Electricista','Electricista certificada. Instalaciones, tableros, iluminación y reparaciones.',8,30000,'disponible','Santiago','Electricista',1,1,0,94,4.8,62,97,99,'2021-07-15'],
  ['pintor.demo@demo.cl','Luis Herrera (DEMO)','Pintor','Pintura interior y exterior, preparación de superficies y terminaciones.',7,20000,'ocupado','Maipú','Pintura',1,0,1,76,4.7,48,94,97,'2020-11-02'],
  ['constructor.demo@demo.cl','Jorge Ramírez (DEMO)','Maestro de construcción','Ampliaciones, tabiquería, radieres y remodelaciones.',14,45000,'disponible','San Bernardo','Construcción',1,1,1,143,4.9,101,99,98,'2018-05-20'],
  ['limpieza.demo@demo.cl','Paula González (DEMO)','Servicios de limpieza','Limpieza profunda de casas, oficinas y post-obra.',6,18000,'disponible','Ñuñoa','Limpieza',0,1,0,87,4.8,55,96,99,'2021-10-12'],
  ['jardinero.demo@demo.cl','Roberto Silva (DEMO)','Jardinero','Mantención de jardines, poda, césped y riego.',11,22000,'disponible','Rancagua','Jardinería',1,0,0,112,4.6,71,95,97,'2019-04-08'],
];
for (const [email,name,oficio,description,years,price,status,comuna,categoria,verified,pro,featured,jobs,rating,ratingCount,response,completion,memberSince] of professionals) {
  const userId = ensureUser({email,name,role:'trabajador',phone:'+56991'+String(Math.floor(Math.random()*100000)).padStart(5,'0'),comuna});
  ensureWorker(userId,{oficio,description,years,price,status,comuna,categoria,verified,phoneVerified:verified,recommended:rating>=4.8,pro,featured,jobs,rating,ratingCount,response,completion,memberSince});
}

console.log('[DatoYa] Demo admin: usuarios y profesionales adicionales disponibles.');

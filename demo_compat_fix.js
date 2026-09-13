// Compatibilidad DEMO: corrige datos de prueba sin relajar las reglas reales de acceso.
const { db, hashPassword } = require('./db');
const pwd = hashPassword('demo1234');

function ensureClient(email, name, comunaId){
  let u = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if(!u){
    u = db.prepare('INSERT INTO users(email,password_hash,name,role,comuna_id,is_active,is_demo) VALUES(?,?,?,?,?,1,1)').run(email,pwd,name,'cliente',comunaId);
    return Number(u.lastInsertRowid);
  }
  db.prepare('UPDATE users SET password_hash=?,name=?,role=?,comuna_id=?,is_active=1,is_demo=1 WHERE id=?').run(pwd,name,'cliente',comunaId,u.id);
  return u.id;
}

// Usuario externo utilizado por las pruebas de aislamiento del chat.
ensureClient('cliente1@demo.cl','Cliente 1 DEMO',4);

// El trabajador DEMO debe ser compatible con las solicitudes E2E de Ñuñoa (4)
// y seguir apareciendo en su zona original de Rancagua.
const wu = db.prepare("SELECT id FROM users WHERE email='trabajador@demo.cl'").get();
if(wu){
  const wp = db.prepare('SELECT id FROM worker_profiles WHERE user_id=?').get(wu.id);
  if(wp){
    for(const name of ['Ñuñoa','Rancagua']){
      const c = db.prepare('SELECT id FROM comunas WHERE name=?').get(name);
      if(c) db.prepare('INSERT OR IGNORE INTO worker_comunas(worker_id,comuna_id) VALUES(?,?)').run(wp.id,c.id);
    }
  }
}

// El expediente DEMO debe ser reconocible como incumplimiento para administración/E2E.
db.prepare("UPDATE reports SET reason='Incumplimiento de servicio DEMO' WHERE reason='Problema con profesional DEMO'").run();

console.log('[DatoYa] DEMO compatibility fixes applied');

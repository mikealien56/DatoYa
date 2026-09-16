// DatoYa 2.0 — arranque real: los datos DEMO no forman parte del runtime.
const dbModule=require('./db');
dbModule.seed=()=>console.log('[DatoYa] Datos ficticios desactivados.');
const {db,setSetting,hashPassword}=dbModule;
setSetting('commission_pct','10');setSetting('pro_price','9990');setSetting('featured_price','4990');setSetting('protection_pct','5');setSetting('protection_review_hours','24');setSetting('protection_enabled','1');
const categories=[['Gasfíter','🔧'],['Electricista','⚡'],['Pintura','🎨'],['Construcción','🧱'],['Limpieza','🧹'],['Jardinería','🌳'],['Tecnología','💻'],['Mecánica','🚗'],['Cerrajería','🔑'],['Cámaras y Seguridad','📹'],['Otros servicios','➕']];
const find=db.prepare('SELECT id FROM categories WHERE lower(name)=lower(?) LIMIT 1'),insert=db.prepare('INSERT INTO categories(name,icon,active) VALUES(?,?,1)');for(const [name,icon] of categories)if(!find.get(name))insert.run(name,icon);
const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),adminPassword=String(process.env.ADMIN_PASSWORD||'');
if(adminEmail){const existing=db.prepare('SELECT id,role FROM users WHERE lower(email)=lower(?) LIMIT 1').get(adminEmail);if(existing){if(existing.role!=='admin'){db.prepare("UPDATE users SET role='admin',is_active=1,is_demo=0 WHERE id=?").run(existing.id);console.log('[DatoYa] Usuario configurado como administrador real.');}else console.log('[DatoYa] Administrador real ya existe.');}else if(adminPassword.length>=10){db.prepare('INSERT INTO users(email,password_hash,name,role,is_active,is_demo) VALUES(?,?,?,?,1,0)').run(adminEmail,hashPassword(adminPassword),'Administrador DatoYa','admin');console.log('[DatoYa] Administrador real inicial creado desde variables privadas.');}else console.log('[DatoYa] ADMIN_EMAIL configurado; registra esa cuenta y reinicia para promoverla a admin.');}else if(adminPassword)throw new Error('ADMIN_PASSWORD no puede configurarse sin ADMIN_EMAIL.');else console.log('[DatoYa] ADMIN_EMAIL no configurado; no se crea administrador automáticamente.');
console.log('[DatoYa] Beta real preparada: catálogo/configuración cargados sin cuentas DEMO.');
module.exports={demoMode:false};

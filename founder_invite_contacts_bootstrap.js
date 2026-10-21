// DatoYa: lista privada de negocios por invitar, administrada por usuarios admin.
// Migración aditiva e idempotente (SQLite local / Neon PostgreSQL en producción).
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

db.exec('CREATE TABLE IF NOT EXISTS founder_invite_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, business_name TEXT NOT NULL, email TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), updated_at TEXT NOT NULL DEFAULT (datetime(\'now\')))');
const serverFile = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverFile, 'utf8');
const marker = '// ============ MISC ============';
const tag = 'DATOYA ADMIN INVITE CONTACTS V1';
if (!source.includes(tag)) {
  if (!source.includes(marker)) throw new Error('[DatoYa] Falta marcador de rutas para invitaciones');
  const insertion = [
    '// ============ ' + tag + ' ============',
    "app.get('/api/admin/marketplace-v2/invite-contacts',auth,requireRole('admin'),(req,res)=>{",
    "  const contacts=db.prepare('SELECT id,business_name,email,created_at,updated_at FROM founder_invite_contacts WHERE created_by_user_id=? ORDER BY updated_at DESC,id DESC LIMIT 200').all(req.user.id);",
    "  res.json({contacts});",
    "});",
    "app.post('/api/admin/marketplace-v2/invite-contacts',auth,requireRole('admin'),(req,res)=>{",
    "  const name=String(req.body?.business_name||'').trim().slice(0,100);",
    "  const email=String(req.body?.email||'').trim().toLowerCase().slice(0,160);",
    "  if(name.length<2)return res.status(400).json({error:'Ingresa un nombre de negocio válido'});",
    "  if(email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return res.status(400).json({error:'El correo no tiene un formato válido'});",
    "  const now=new Date().toISOString();",
    "  const old=db.prepare('SELECT id,email FROM founder_invite_contacts WHERE created_by_user_id=? AND lower(business_name)=lower(?) ORDER BY id LIMIT 1').get(req.user.id,name);",
    "  if(old){",
    "    db.prepare('UPDATE founder_invite_contacts SET business_name=?,email=?,updated_at=? WHERE id=? AND created_by_user_id=?').run(name,email||old.email||null,now,old.id,req.user.id);",
    "    return res.json({ok:true,contact:db.prepare('SELECT id,business_name,email FROM founder_invite_contacts WHERE id=? AND created_by_user_id=?').get(old.id,req.user.id)});",
    "  }",
    "  const row=db.prepare('INSERT INTO founder_invite_contacts(created_by_user_id,business_name,email,created_at,updated_at) VALUES(?,?,?,?,?)').run(req.user.id,name,email||null,now,now);",
    "  const contact=db.prepare('SELECT id,business_name,email FROM founder_invite_contacts WHERE id=? AND created_by_user_id=?').get(Number(row.lastInsertRowid),req.user.id);",
    "  res.json({ok:true,contact});",
    "});",
    '// ============ FIN ' + tag + ' ============',
    ''
  ].join('\n');
  source=source.replace(marker,insertion+'\n'+marker);
  fs.writeFileSync(serverFile,source);
}
console.log('[DatoYa] Agenda privada de invitaciones disponible para administración.');

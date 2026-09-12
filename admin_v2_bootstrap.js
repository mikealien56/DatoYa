// DatoYa 2.0 — funciones administrativas y suscripciones DEMO
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const serverFile = path.join(ROOT, 'server.js');
const originalReadFileSync = fs.readFileSync;
const { db } = require('./db');

for (const sql of [
  "ALTER TABLE verification_requests ADD COLUMN document_type TEXT",
  "ALTER TABLE verification_requests ADD COLUMN document_reference TEXT",
  "ALTER TABLE verification_requests ADD COLUMN ticket TEXT",
  "ALTER TABLE subscriptions ADD COLUMN expires_at TEXT",
  "ALTER TABLE subscriptions ADD COLUMN amount INTEGER DEFAULT 0"
]) { try { db.exec(sql); } catch (e) { if (!String(e).includes('duplicate column name')) throw e; } }
try { db.exec(`CREATE TABLE IF NOT EXISTS worker_bank_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER UNIQUE NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE, bank_name TEXT, account_type TEXT, account_last4 TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`) } catch (e) { throw e; }

const injection = `
// ============ DATOYA 2.0 ADMIN / PRO ============
app.get('/api/admin/disputes', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare("SELECT j.id,j.status,j.price,j.created_at,u.name client_name,uw.name worker_name FROM jobs j JOIN users u ON u.id=j.client_id JOIN worker_profiles wp ON wp.id=j.worker_id JOIN users uw ON uw.id=wp.user_id WHERE j.status='DISPUTA' ORDER BY j.updated_at DESC").all();
  res.json({disputes:rows});
});
app.get('/api/admin/bank', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare("SELECT u.id,u.name,u.email,wp.id worker_id,wp.is_pro,wp.verified_identity,ba.bank_name,ba.account_type,ba.account_last4 FROM worker_profiles wp JOIN users u ON u.id=wp.user_id LEFT JOIN worker_bank_accounts ba ON ba.worker_id=wp.id WHERE u.is_active=1 ORDER BY u.name").all();
  res.json({accounts:rows,mode:'DEMO'});
});
app.get('/api/admin/messages', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare("SELECT c.id,c.created_at,c.job_id,c.request_id,cu.name client_name,wu.name worker_name,(SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_msg,(SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_at FROM conversations c JOIN users cu ON cu.id=c.client_id JOIN worker_profiles wp ON wp.id=c.worker_id JOIN users wu ON wu.id=wp.user_id ORDER BY COALESCE(last_at,c.created_at) DESC LIMIT 100").all();
  res.json({conversations:rows});
});
app.get('/api/admin/earnings', auth, requireRole('admin'), (req,res) => {
  const r=db.prepare('SELECT COALESCE(SUM(amount),0) gross,COALESCE(SUM(commission),0) commissions,COALESCE(SUM(worker_amount),0) workers FROM payments').get();
  const payouts=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payout_requests WHERE status='pagado'").get().n;
  res.json({gross:r.gross,commissions:r.commissions,workers:r.workers,payouts,net:r.commissions});
});
app.get('/api/admin/verification-requests', auth, requireRole('admin'), (req,res) => {
  res.json({requests:db.prepare("SELECT vr.*,wp.oficio,u.name,u.email FROM verification_requests vr JOIN worker_profiles wp ON wp.id=vr.worker_id JOIN users u ON u.id=wp.user_id ORDER BY vr.created_at DESC").all()});
});
app.post('/api/worker/verification-request', auth, requireRole('trabajador'), (req,res) => {
  const wp=getWorkerByUser(req.user.id), {document_type,document_reference,ticket}=req.body||{};
  if(!document_type||!ticket) return res.status(400).json({error:'Tipo de documento y ticket son obligatorios'});
  const exists=db.prepare("SELECT id FROM verification_requests WHERE worker_id=? AND type='identidad' AND status='pendiente'").get(wp.id);
  if(exists) return res.status(409).json({error:'Ya tienes una verificación pendiente'});
  const info=db.prepare('INSERT INTO verification_requests(worker_id,type,status,document_type,document_reference,ticket) VALUES(?,?,?,?,?,?)').run(wp.id,'identidad','pendiente',document_type,String(document_reference||''),String(ticket).trim());
  const admin=db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1 LIMIT 1").get();
  if(admin) notify(admin.id,'verificacion','Nueva solicitud de verificación profesional #'+info.lastInsertRowid,'#/admin/verificaciones');
  res.json({ok:true,id:info.lastInsertRowid,message:'Solicitud enviada. Ticket #'+info.lastInsertRowid+'. Queda pendiente de revisión.'});
});
app.post('/api/admin/verification-requests/:id/resolve', auth, requireRole('admin'), (req,res) => {
  const row=db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id); if(!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const status=req.body?.action==='aprobar'?'aprobada':'rechazada'; db.prepare('UPDATE verification_requests SET status=? WHERE id=?').run(status,row.id);
  if(status==='aprobada') db.prepare('UPDATE worker_profiles SET verified_identity=1 WHERE id=?').run(row.worker_id);
  const w=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(row.worker_id); if(w) notify(w.user_id,'verificacion',status==='aprobada'?'¡Identidad profesional verificada! ✓':'Tu solicitud de verificación fue rechazada. Revisa los datos y vuelve a solicitar.','#/perfil');
  res.json({ok:true,status});
});
app.get('/api/admin/subscriptions', auth, requireRole('admin'), (req,res) => {
  res.json({subscriptions:db.prepare("SELECT s.*,u.name,u.email FROM subscriptions s JOIN worker_profiles wp ON wp.id=s.worker_id JOIN users u ON u.id=wp.user_id ORDER BY s.started_at DESC").all()});
});
app.post('/api/worker/subscription', auth, requireRole('trabajador'), (req,res) => {
  const wp=getWorkerByUser(req.user.id), plan=req.body?.plan==='ANUAL'?'ANUAL':'MENSUAL';
  const monthly=Number(getSetting('pro_price',9990)), amount=plan==='ANUAL'?Math.round(monthly*10):monthly;
  const days=plan==='ANUAL'?365:30; const expires=new Date(Date.now()+days*86400000).toISOString().slice(0,19).replace('T',' ');
  db.prepare("UPDATE subscriptions SET status='cancelada' WHERE worker_id=? AND status='activa'").run(wp.id);
  db.prepare('INSERT INTO subscriptions(worker_id,plan,status,expires_at,amount) VALUES(?,?,?,?,?)').run(wp.id,plan,'activa',expires,amount);
  db.prepare('UPDATE worker_profiles SET is_pro=1 WHERE id=?').run(wp.id);
  res.json({ok:true,plan,message:'Suscripción DatoYa PRO activada en MODO DEMO. No se realizó ningún cobro real.'});
});
app.get('/api/worker/subscription', auth, requireRole('trabajador'), (req,res) => {
  const wp=getWorkerByUser(req.user.id); const row=db.prepare("SELECT * FROM subscriptions WHERE worker_id=? AND status='activa' ORDER BY id DESC LIMIT 1").get(wp.id); res.json({subscription:row||null});
});
app.get('/api/worker/bank', auth, requireRole('trabajador'), (req,res) => {
  const wp=getWorkerByUser(req.user.id); const account=db.prepare('SELECT bank_name,account_type,account_last4,updated_at FROM worker_bank_accounts WHERE worker_id=?').get(wp.id);
  res.json({account:account||null,mode:'DEMO'});
});
app.post('/api/worker/bank', auth, requireRole('trabajador'), (req,res) => {
  const wp=getWorkerByUser(req.user.id), {bank_name,account_type,account_last4}=req.body||{};
  if(!bank_name||!account_type||!/^[0-9]{4}$/.test(String(account_last4||''))) return res.status(400).json({error:'Banco, tipo de cuenta y últimos 4 dígitos son obligatorios'});
  db.prepare("INSERT INTO worker_bank_accounts(worker_id,bank_name,account_type,account_last4,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(worker_id) DO UPDATE SET bank_name=excluded.bank_name,account_type=excluded.account_type,account_last4=excluded.account_last4,updated_at=datetime('now')").run(wp.id,bank_name,account_type,String(account_last4));
  res.json({ok:true,message:'Cuenta de retiro guardada en MODO DEMO.'});
});
// ================================================
`;
const original=fs.readFileSync(serverFile,'utf8');
const marker="app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:${PORT}`));";
const patched=original.includes('// ============ DATOYA 2.0 ADMIN / PRO ============')?original:original.replace(marker,injection+'\n'+marker);
if(patched===original && !original.includes('// ============ DATOYA 2.0 ADMIN / PRO ============')) throw new Error('No se encontró el marcador de arranque de server.js');
fs.readFileSync=function(file,enc){if(path.resolve(file)===serverFile)return enc?patched:Buffer.from(patched);return originalReadFileSync.apply(fs,arguments)};
// Si se ejecuta desde territory_start, server.js se carga una sola vez al final de la cadena.
if (require.main === module) {
  try { require('./server'); } finally { fs.readFileSync=originalReadFileSync; }
} else {
  fs.readFileSync=originalReadFileSync;
}

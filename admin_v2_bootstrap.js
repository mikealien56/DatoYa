// DatoYa 2.0 — funciones administrativas y suscripciones DEMO
// Inyecta endpoints sobre el backend existente sin reconstruir server.js.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ROOT = __dirname;
const serverFile = path.join(ROOT, 'server.js');
const originalReadFileSync = fs.readFileSync;

const injection = `
// ============ DATOYA 2.0 ADMIN / PRO ============
app.get('/api/admin/overview-v2', auth, requireRole('admin'), (req,res) => {
  const pendingVerifications = db.prepare("SELECT COUNT(*) c FROM verification_requests WHERE status='pendiente'").get().c;
  const pendingReports = db.prepare("SELECT COUNT(*) c FROM reports WHERE status='pendiente'").get().c;
  const disputes = db.prepare("SELECT COUNT(*) c FROM jobs WHERE status='DISPUTA'").get().c;
  const gross = db.prepare('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE status LIKE \\"demo%\\" OR status=\\"demo_completado\\"').get().n;
  const commissions = db.prepare('SELECT COALESCE(SUM(commission),0) n FROM payments').get().n;
  const pro = db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status='activa'").get().c;
  res.json({ pending_verifications: pendingVerifications, pending_reports: pendingReports, disputes, gross, commissions, active_pro: pro });
});
app.get('/api/admin/disputes', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare(`SELECT j.id,j.status,j.price,j.created_at,u.name AS client_name,uw.name AS worker_name
    FROM jobs j JOIN users u ON u.id=j.client_id JOIN worker_profiles wp ON wp.id=j.worker_id JOIN users uw ON uw.id=wp.user_id
    WHERE j.status='DISPUTA' ORDER BY j.updated_at DESC`).all();
  res.json({ disputes: rows });
});
app.get('/api/admin/bank', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare(`SELECT u.id,u.name,u.email,u.phone,wp.id worker_id,wp.is_pro,wp.verified_identity
    FROM worker_profiles wp JOIN users u ON u.id=wp.user_id WHERE u.is_active=1 ORDER BY u.name`).all();
  res.json({ accounts: rows, mode: 'DEMO' });
});
app.get('/api/admin/messages', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare(`SELECT c.id,c.created_at,c.job_id,c.request_id,
    cu.name client_name,wu.name worker_name,
    (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_msg,
    (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_at
    FROM conversations c JOIN users cu ON cu.id=c.client_id JOIN worker_profiles wp ON wp.id=c.worker_id JOIN users wu ON wu.id=wp.user_id
    ORDER BY COALESCE(last_at,c.created_at) DESC LIMIT 100`).all();
  res.json({ conversations: rows });
});
app.get('/api/admin/earnings', auth, requireRole('admin'), (req,res) => {
  const r = db.prepare(`SELECT COALESCE(SUM(amount),0) gross, COALESCE(SUM(commission),0) commissions,
    COALESCE(SUM(worker_amount),0) workers FROM payments`).get();
  const payouts = db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payout_requests WHERE status='pagado'").get().n;
  res.json({ gross:r.gross, commissions:r.commissions, workers:r.workers, payouts, net:r.commissions });
});
app.get('/api/admin/verification-requests', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare(`SELECT vr.*,wp.oficio,u.name,u.email FROM verification_requests vr
    JOIN worker_profiles wp ON wp.id=vr.worker_id JOIN users u ON u.id=wp.user_id ORDER BY vr.created_at DESC`).all();
  res.json({ requests: rows });
});
app.post('/api/worker/verification-request', auth, requireRole('trabajador'), (req,res) => {
  const wp = getWorkerByUser(req.user.id);
  const { document_type, document_reference, ticket } = req.body || {};
  if (!document_type || !ticket) return res.status(400).json({error:'Tipo de documento y ticket son obligatorios'});
  const exists = db.prepare("SELECT id FROM verification_requests WHERE worker_id=? AND type='identidad' AND status='pendiente'").get(wp.id);
  if (exists) return res.status(409).json({error:'Ya tienes una verificación pendiente'});
  const info = db.prepare("INSERT INTO verification_requests(worker_id,type,document_type,document_reference,ticket) VALUES(?,?,?,?,?)")
    .run(wp.id,'identidad',document_type,String(document_reference||''),String(ticket).trim());
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1 LIMIT 1").get();
  if (admin) notify(admin.id,'verificacion','Nueva solicitud de verificación profesional #'+info.lastInsertRowid,'#/admin/verificaciones');
  res.json({ok:true,id:info.lastInsertRowid,message:'Solicitud enviada. Tu ticket es #'+info.lastInsertRowid+'. Queda pendiente de revisión.'});
});
app.post('/api/admin/verification-requests/:id/resolve', auth, requireRole('admin'), (req,res) => {
  const { action } = req.body || {};
  const row = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const status = action === 'aprobar' ? 'aprobada' : 'rechazada';
  db.prepare('UPDATE verification_requests SET status=? WHERE id=?').run(status,row.id);
  if (status === 'aprobada') db.prepare('UPDATE worker_profiles SET verified_identity=1 WHERE id=?').run(row.worker_id);
  const w = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(row.worker_id);
  if (w) notify(w.user_id,'verificacion',status === 'aprobada' ? '¡Identidad profesional verificada! ✓' : 'Tu solicitud de verificación fue rechazada. Revisa los datos y vuelve a solicitar.','#/perfil');
  res.json({ok:true,status});
});
app.post('/api/worker/subscription', auth, requireRole('trabajador'), (req,res) => {
  const wp = getWorkerByUser(req.user.id);
  const plan = req.body?.plan === 'ANUAL' ? 'ANUAL' : 'MENSUAL';
  db.prepare("UPDATE subscriptions SET status='cancelada' WHERE worker_id=? AND status='activa'").run(wp.id);
  db.prepare('INSERT INTO subscriptions(worker_id,plan,status) VALUES(?,?,?)').run(wp.id,plan,'activa');
  db.prepare('UPDATE worker_profiles SET is_pro=1 WHERE id=?').run(wp.id);
  res.json({ok:true,plan,message:'Suscripción DatoYa PRO activada en MODO DEMO. No se realizó ningún cobro real.'});
});
app.get('/api/worker/subscription', auth, requireRole('trabajador'), (req,res) => {
  const wp = getWorkerByUser(req.user.id);
  const row = db.prepare("SELECT * FROM subscriptions WHERE worker_id=? AND status='activa' ORDER BY id DESC LIMIT 1").get(wp.id);
  res.json({subscription:row||null});
});
// ================================================
`;

const original = fs.readFileSync(serverFile, 'utf8');
if (!original.includes('// ============ DATOYA 2.0 ADMIN / PRO ============')) {
  const marker = "app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:${PORT}`));";
  const patched = original.replace(marker, injection + '\n' + marker);
  if (patched === original) throw new Error('No se encontró el marcador de arranque de server.js');
  fs.readFileSync = function(file, enc) {
    if (path.resolve(file) === serverFile) return enc ? patched : Buffer.from(patched);
    return originalReadFileSync.apply(fs, arguments);
  };
}
try { require('./server'); } finally { fs.readFileSync = originalReadFileSync; }

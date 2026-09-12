// DatoYa 2.0 — flujo de verificación profesional / antecedentes adicionales
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const { db } = require('./db');

try {
  db.exec(`CREATE TABLE IF NOT EXISTS verification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verification_id INTEGER NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
    actor_user_id INTEGER,
    actor_role TEXT,
    action TEXT NOT NULL,
    note TEXT,
    requested_documents TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
} catch (e) { throw e; }

const injection = `
// ============ VERIFICACIÓN PROFESIONAL DATOYA 2.0 ============
app.get('/api/admin/verification-requests/:id', auth, requireRole('admin'), (req,res) => {
  const row = db.prepare("SELECT vr.*,wp.oficio,u.name,u.email,u.phone FROM verification_requests vr JOIN worker_profiles wp ON wp.id=vr.worker_id JOIN users u ON u.id=wp.user_id WHERE vr.id=?").get(req.params.id);
  if (!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const history = db.prepare('SELECT * FROM verification_history WHERE verification_id=? ORDER BY id DESC').all(row.id);
  res.json({request:row, history});
});

app.post('/api/admin/verification-requests/:id/request-documents', auth, requireRole('admin'), (req,res) => {
  const row = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const note = String(req.body?.note || '').trim();
  let requested = req.body?.requested_documents;
  if (!Array.isArray(requested)) requested = String(requested || '').split('\\n').map(x=>x.trim()).filter(Boolean);
  if (!requested.length && !note) return res.status(400).json({error:'Indica qué antecedente necesitas solicitar'});
  const requestedText = requested.join('\\n');
  db.prepare("UPDATE verification_requests SET status='pendiente_antecedentes' WHERE id=?").run(row.id);
  db.prepare('INSERT INTO verification_history(verification_id,actor_user_id,actor_role,action,note,requested_documents) VALUES(?,?,?,?,?,?)').run(row.id,req.user.id,'admin','antecedentes_solicitados',note,requestedText);
  const w = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(row.worker_id);
  if (w) notify(w.user_id,'verificacion','DatoYa solicita antecedentes adicionales para tu verificación.','#/perfil');
  res.json({ok:true,status:'pendiente_antecedentes',requested_documents:requested,note});
});

app.get('/api/worker/verification-requests', auth, requireRole('trabajador'), (req,res) => {
  const wp = getWorkerByUser(req.user.id);
  const requests = db.prepare('SELECT * FROM verification_requests WHERE worker_id=? ORDER BY id DESC').all(wp.id);
  const history = db.prepare('SELECT * FROM verification_history WHERE verification_id IN (SELECT id FROM verification_requests WHERE worker_id=?) ORDER BY id DESC').all(wp.id);
  res.json({requests,history});
});

app.post('/api/worker/verification-requests/:id/add-document', auth, requireRole('trabajador'), (req,res) => {
  const wp = getWorkerByUser(req.user.id);
  const row = db.prepare('SELECT * FROM verification_requests WHERE id=? AND worker_id=?').get(req.params.id,wp.id);
  if (!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const documentType = String(req.body?.document_type || '').trim();
  const reference = String(req.body?.document_reference || '').trim();
  if (!documentType || !reference) return res.status(400).json({error:'Tipo y referencia del antecedente son obligatorios'});
  const merged = row.document_reference ? row.document_reference + '\\n' + documentType + ': ' + reference : documentType + ': ' + reference;
  db.prepare("UPDATE verification_requests SET document_type=?,document_reference=?,status='pendiente' WHERE id=?").run(documentType,merged,row.id);
  db.prepare('INSERT INTO verification_history(verification_id,actor_user_id,actor_role,action,note,requested_documents) VALUES(?,?,?,?,?,?)').run(row.id,req.user.id,'trabajador','antecedente_enviado','El profesional agregó un antecedente.',documentType + ': ' + reference);
  const admin=db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1 LIMIT 1").get();
  if(admin) notify(admin.id,'verificacion','El profesional agregó antecedentes a la verificación #'+row.id,'#/admin/verificaciones');
  res.json({ok:true,status:'pendiente',message:'Antecedente enviado a revisión.'});
});

app.post('/api/admin/verification-requests/:id/resolve', auth, requireRole('admin'), (req,res) => {
  const row=db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id); if(!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const action=req.body?.action;
  if(action!=='aprobar' && action!=='rechazar') return res.status(400).json({error:'Acción inválida'});
  const status=action==='aprobar'?'aprobada':'rechazada';
  const note=String(req.body?.note||'').trim();
  db.prepare('UPDATE verification_requests SET status=? WHERE id=?').run(status,row.id);
  db.prepare('INSERT INTO verification_history(verification_id,actor_user_id,actor_role,action,note,requested_documents) VALUES(?,?,?,?,?,?)').run(row.id,req.user.id,'admin',status==='aprobada'?'aprobada':'rechazada',note,null);
  if(status==='aprobada') db.prepare('UPDATE worker_profiles SET verified_identity=1 WHERE id=?').run(row.worker_id);
  const w=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(row.worker_id);
  if(w) notify(w.user_id,'verificacion',status==='aprobada'?'¡Identidad profesional verificada! ✓':'Tu solicitud de verificación fue rechazada. Revisa los datos y vuelve a solicitar.','#/perfil');
  res.json({ok:true,status,note});
});
// ============================================================
`;

const original = fs.readFileSync(serverPath,'utf8');
const marker = '// ============ DENUNCIAS ============';
const patched = original.includes('// ============ VERIFICACIÓN PROFESIONAL DATOYA 2.0 ============')
  ? original
  : original.replace(marker, injection + '\n' + marker);
if (patched === original && !original.includes('// ============ VERIFICACIÓN PROFESIONAL DATOYA 2.0 ============')) throw new Error('No se encontró el marcador para verificación');
fs.writeFileSync(serverPath,patched);

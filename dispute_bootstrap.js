// DatoYa — ciclo de disputas/correcciones (runtime DEMO)
// Se inyecta antes de Protección DatoYa para conservar el flujo existente.
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

function injectDisputes(source) {
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección de disputas');
  if (source.includes('job_disputes')) return source;

  const block = `
// ============ DISPUTAS Y CORRECCIONES DATOYA ============
function disputeForJob(jobId) {
  return db.prepare('SELECT * FROM job_disputes WHERE job_id=? ORDER BY id DESC LIMIT 1').get(jobId);
}
function disputeEvent(disputeId, type, actorId, metadata) {
  db.prepare('INSERT INTO job_dispute_events(dispute_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)')
    .run(disputeId, type, actorId || null, metadata ? JSON.stringify(metadata) : null);
}
function ensureDispute(job, actorId, reason) {
  const existing = disputeForJob(job.id);
  if (existing && ['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(existing.status)) return existing;
  const id = db.prepare('INSERT INTO job_disputes(job_id,opened_by,reason,status) VALUES(?,?,?,?)')
    .run(job.id, actorId, reason, 'OPEN').lastInsertRowid;
  disputeEvent(id, 'dispute_opened', actorId, { reason });
  return disputeForJob(job.id);
}

// Complementa la apertura de disputa de Protección DatoYa con un expediente auditable.
app.use('/api/jobs/:id/status', auth, (req, res, next) => {
  if (String((req.body || {}).status || '') !== 'DISPUTA') return next();
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (req.user.role !== 'admin' && job.client_id !== req.user.id && (!wp || wp.user_id !== req.user.id)) return res.status(403).json({ error:'Sin acceso' });
  const reason = String((req.body || {}).reason || '').trim().slice(0,2000);
  if (!reason) return next();
  const existing = disputeForJob(job.id);
  if (!existing || !['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(existing.status)) ensureDispute(job, req.user.id, reason);
  return next();
});

app.get('/api/jobs/:id/dispute', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (req.user.role !== 'admin' && job.client_id !== req.user.id && (!wp || wp.user_id !== req.user.id)) return res.status(403).json({ error:'Sin acceso' });
  const dispute = disputeForJob(job.id);
  const events = dispute ? db.prepare('SELECT * FROM job_dispute_events WHERE dispute_id=? ORDER BY id').all(dispute.id) : [];
  res.json({ dispute, events, demo:true });
});

// El trabajador completa la corrección solicitada. El trabajo vuelve a revisión del cliente.
app.post('/api/jobs/:id/correction/complete', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (!wp || wp.user_id !== req.user.id) return res.status(403).json({ error:'Solo el profesional asociado puede completar la corrección' });
  const dispute = disputeForJob(job.id);
  const protection = db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);
  if (!dispute || dispute.status !== 'CORRECTION_REQUIRED') return res.status(409).json({ error:'El trabajo no tiene una corrección pendiente' });
  if (!protection || protection.status !== 'CORRECTION') return res.status(409).json({ error:'La protección no está en corrección' });
  const note = String((req.body || {}).note || '').trim().slice(0,2000);
  db.transaction(() => {
    db.prepare("UPDATE jobs SET status='EN_PROCESO',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare("UPDATE job_disputes SET status='AWAITING_REVIEW',resolution=?,updated_at=datetime('now') WHERE id=?").run(note || 'Corrección realizada por el profesional', dispute.id);
    db.prepare("UPDATE payment_protections SET status='AWAITING_CONFIRMATION',dispute_reason=NULL,updated_at=datetime('now') WHERE job_id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'EN_PROCESO',req.user.id);
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'correccion_realizada',req.user.id,JSON.stringify({ note }));
    disputeEvent(dispute.id,'correction_completed',req.user.id,{ note });
    db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(protection.id,'correction_completed',req.user.id,JSON.stringify({ note }));
  })();
  notify(job.client_id,'trabajo','El profesional informó que realizó la corrección. Revisa nuevamente el trabajo y sus evidencias.','#/trabajos');
  res.json({ ok:true,status:'AWAITING_REVIEW',demo:true });
});

// Admin abre formalmente la revisión y puede pedir corrección sin destruir evidencias anteriores.
app.post('/api/admin/jobs/:id/dispute/review', auth, requireRole('admin'), (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const protection = db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);
  if (!protection || !['DISPUTED','CORRECTION'].includes(protection.status)) return res.status(409).json({ error:'No hay una disputa activa para revisar' });
  const reason = String((req.body || {}).reason || protection.dispute_reason || '').trim().slice(0,4000);
  if (!reason) return res.status(400).json({ error:'Motivo de revisión obligatorio' });
  const dispute = disputeForJob(job.id) || ensureDispute(job, req.user.id, reason);
  db.prepare("UPDATE job_disputes SET status='UNDER_REVIEW',updated_at=datetime('now') WHERE id=?").run(dispute.id);
  disputeEvent(dispute.id,'admin_review_started',req.user.id,{ reason });
  res.json({ ok:true, dispute:disputeForJob(job.id), demo:true });
});

// Reemplaza solo el destino del flujo administrativo de corrección con un estado persistente.
app.use('/api/admin/jobs/:id/protection/resolve', auth, requireRole('admin'), (req,res,next) => {
  if (String((req.body || {}).action || '') !== 'correction') return next();
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const reason = String((req.body || {}).resolution || '').trim().slice(0,4000);
  if (!reason) return res.status(400).json({ error:'La resolución es obligatoria' });
  const protection = db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);
  if (!protection || !['DISPUTED','CORRECTION'].includes(protection.status)) return res.status(409).json({ error:'El pago no está en disputa' });
  const dispute = disputeForJob(job.id) || ensureDispute(job, req.user.id, protection.dispute_reason || reason);
  db.transaction(() => {
    db.prepare("UPDATE payment_protections SET status='CORRECTION',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?").run(reason,req.user.id,job.id);
    db.prepare("UPDATE job_disputes SET status='CORRECTION_REQUIRED',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE id=?").run(reason,req.user.id,dispute.id);
    disputeEvent(dispute.id,'correction_required',req.user.id,{ resolution:reason });
    db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(protection.id,'correction_required',req.user.id,JSON.stringify({ resolution:reason }));
  })();
  const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (wp) notify(wp.user_id,'disputa','DatoYa solicitó una corrección del trabajo antes de liberar el pago.','#/trabajos');
  res.json({ ok:true, status:'CORRECTION_REQUIRED', dispute:disputeForJob(job.id), demo:true });
});

// Expediente administrativo: una sola respuesta reúne lo necesario para investigar el caso.
app.get('/api/admin/jobs/:id/dispute/case', auth, requireRole('admin'), (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const protection = db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);
  const dispute = disputeForJob(job.id);
  const evidence = db.prepare('SELECT * FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id);
  const photos = db.prepare('SELECT id,user_id,phase,storage_key,is_private,created_at FROM job_photos WHERE job_id=? ORDER BY id').all(job.id);
  const events = db.prepare('SELECT * FROM job_events WHERE job_id=? ORDER BY id').all(job.id);
  const history = db.prepare('SELECT * FROM job_status_history WHERE job_id=? ORDER BY id').all(job.id);
  const messages = db.prepare('SELECT * FROM messages WHERE job_id=? ORDER BY id').all(job.id);
  const disputeEvents = dispute ? db.prepare('SELECT * FROM job_dispute_events WHERE dispute_id=? ORDER BY id').all(dispute.id) : [];
  res.json({ job, worker_profile:wp, protection, dispute, evidence, photos, events, history, messages, dispute_events:disputeEvents, demo:true });
});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === path.resolve(serverFile) && typeof value === 'string') return injectDisputes(value);
  return value;
};

// Encadena la inyección con Protección DatoYa y el runtime existente.
try {
  require('./protection_bootstrap');
} finally {
  fs.readFileSync = originalReadFileSync;
}

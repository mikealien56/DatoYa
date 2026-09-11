// DatoYa — Protección DatoYa (runtime DEMO)
// Se monta antes de demo_bootstrap y reutiliza el backend existente.
// No procesa dinero real: modela estados, retención, confirmación y disputas.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');

function injectProtection(source) {
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección de Protección DatoYa');
  if (source.includes('payment_protections')) return source;

  const block = `
// ============ PROTECCIÓN DATOYA ============
function protectionConfig() {
  return {
    pct: Number(getSetting('protection_pct', '5')),
    reviewHours: Number(getSetting('protection_review_hours', '24')),
    enabled: String(getSetting('protection_enabled', '1')) === '1'
  };
}
function protectionForJob(jobId) {
  return db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(jobId);
}
function createProtectionForJob(job) {
  const cfg = protectionConfig();
  const existing = protectionForJob(job.id);
  if (existing) return existing;
  const protectionAmount = Math.round(job.price * cfg.pct / 100);
  const clientTotal = job.price + protectionAmount;
  const workerNet = job.worker_amount;
  const id = db.prepare(\`INSERT INTO payment_protections(job_id,service_amount,commission_pct,commission_amount,protection_pct,protection_amount,client_total,worker_net,status)
    VALUES(?,?,?,?,?,?,?,?,?)\`).run(job.id, job.price, job.commission_pct, job.commission_amount, cfg.pct, protectionAmount, clientTotal, workerNet, 'HELD').lastInsertRowid;
  db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)')
    .run(id, 'payment_held_demo', job.client_id, JSON.stringify({ demo:true, protection_pct:cfg.pct }));
  return protectionForJob(job.id);
}
function addProtectionEvent(protectionId, type, actor, metadata) {
  db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)')
    .run(protectionId, type, actor || null, metadata ? JSON.stringify(metadata) : null);
}
function insertDemoRelease(job, actorId) {
  if (!db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id)) {
    db.prepare(\`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_liberado_protegido')\`)
      .run(job.id, job.price, job.commission_amount, job.worker_amount);
    db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id, job.commission_pct, job.commission_amount);
    const payment = db.prepare('SELECT id FROM payments WHERE job_id=? ORDER BY id DESC LIMIT 1').get(job.id);
    const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
    db.prepare('INSERT INTO ledger_entries(user_id,job_id,payment_id,type,amount,reference,metadata) VALUES(?,?,?,?,?,?,?)')
      .run(wp.user_id, job.id, payment.id, 'INGRESO', job.worker_amount, 'datoya_protected_release', JSON.stringify({ demo:true }));
    db.prepare('INSERT INTO ledger_entries(user_id,job_id,payment_id,type,amount,reference,metadata) VALUES(?,?,?,?,?,?,?)')
      .run(job.client_id, job.id, payment.id, 'COMISION', job.commission_amount, 'datoya_commission', JSON.stringify({ demo:true, pct:job.commission_pct }));
  }
  return db.prepare('SELECT id FROM payments WHERE job_id=? ORDER BY id DESC LIMIT 1').get(job.id);
}
function finalizeProtectedJob(job, actorId) {
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const protection = createProtectionForJob(job);
  const tx = db.transaction(() => {
    db.prepare(\`UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=?\`).run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id, 'FINALIZADO', actorId);
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)')
      .run(job.id, 'status_changed', actorId, JSON.stringify({ from: job.status, to: 'FINALIZADO', protected_payment:true }));
    if (job.status !== 'FINALIZADO') db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
    insertDemoRelease(job, actorId);
    db.prepare(\`UPDATE payment_protections SET status='RELEASED',released_at=datetime('now'),updated_at=datetime('now') WHERE job_id=?\`).run(job.id);
    addProtectionEvent(protection.id, 'payment_released', actorId, { demo:true });
  });
  tx();
  notify(job.client_id, 'pago', \`Trabajo confirmado. Pago protegido liberado en MODO DEMO: \${fmtCLP(job.price)}.\`, '#/trabajos');
  notify(wp.user_id, 'pago', \`El cliente confirmó el trabajo. Pago liberado: \${fmtCLP(job.worker_amount)}. MODO DEMO.\`, '#/trabajos');
  return protectionForJob(job.id);
}

// Al aceptar una cotización, se crea la representación DEMO del dinero protegido.
app.use('/api/quotes/:id/accept', auth, (req, res, next) => {
  const quoteId = req.params.id;
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    try {
      const job = db.prepare('SELECT * FROM jobs WHERE quote_id=?').get(quoteId);
      if (job) createProtectionForJob(job);
    } catch (_) {}
  });
  next();
});

// El profesional declara que terminó: todavía NO se libera el pago.
app.post('/api/jobs/:id/complete-request', auth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (!wp || wp.user_id !== req.user.id) return res.status(403).json({ error:'Solo el profesional asociado puede indicar que terminó' });
  if (!['CONFIRMADO','EN_PROCESO'].includes(job.status)) return res.status(409).json({ error:'El trabajo no está en una etapa válida para terminarlo' });
  const protection = createProtectionForJob(job);
  const cfg = protectionConfig();
  const deadline = cfg.reviewHours > 0 ? new Date(Date.now() + cfg.reviewHours * 3600000).toISOString().slice(0,19).replace('T',' ') : null;
  db.prepare(\`UPDATE payment_protections SET status='AWAITING_CONFIRMATION',review_deadline=?,updated_at=datetime('now') WHERE job_id=?\`).run(deadline, job.id);
  const eventId = db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id, 'trabajo_terminado', req.user.id, JSON.stringify({ review_deadline:deadline })).lastInsertRowid;
  addProtectionEvent(protection.id, 'awaiting_client_confirmation', req.user.id, { event_id:eventId, review_deadline:deadline });
  notify(job.client_id, 'trabajo', 'El profesional indicó que terminó el trabajo. Revisa las evidencias y confirma o reporta un problema.', '#/trabajos');
  res.json({ ok:true, status:'AWAITING_CONFIRMATION', review_deadline:deadline, demo:true });
});

// Estado protegido: FINALIZADO significa confirmación del cliente; DISPUTA retiene el pago.
app.use('/api/jobs/:id/status', auth, (req, res, next) => {
  const requested = String((req.body || {}).status || '');
  if (!['FINALIZADO','DISPUTA'].includes(requested)) return next();
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isWorker = !!wp && wp.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isClient && !isWorker && !isAdmin) return res.status(403).json({ error:'Sin acceso' });

  if (requested === 'FINALIZADO') {
    if (!isClient && !isAdmin) return res.status(403).json({ error:'Solo el cliente puede confirmar el trabajo terminado' });
    if (['FINALIZADO','CANCELADO'].includes(job.status)) return res.status(409).json({ error:'El trabajo ya no admite confirmación' });
    const protection = finalizeProtectedJob(job, req.user.id);
    return res.json({ ok:true, status:'FINALIZADO', protection, demo:true });
  }

  if (!['TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','DISPUTA'].includes(job.status)) return res.status(409).json({ error:'No se puede abrir una disputa desde este estado' });
  const reason = String((req.body || {}).reason || '').trim().slice(0,2000);
  if (!reason) return res.status(400).json({ error:'Debes indicar el motivo de la disputa' });
  const protection = createProtectionForJob(job);
  db.prepare(\`UPDATE jobs SET status='DISPUTA',updated_at=datetime('now') WHERE id=?\`).run(job.id);
  db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'DISPUTA',req.user.id);
  db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'status_changed',req.user.id,JSON.stringify({ from:job.status,to:'DISPUTA',reason }));
  db.prepare(\`UPDATE payment_protections SET status='DISPUTED',dispute_reason=?,updated_at=datetime('now') WHERE job_id=?\`).run(reason,job.id);
  addProtectionEvent(protection.id,'dispute_opened',req.user.id,{ reason });
  notify(isClient ? wp.user_id : job.client_id,'disputa','Se abrió una disputa sobre el trabajo. El pago permanece protegido en MODO DEMO mientras se revisa.','#/trabajos');
  res.json({ ok:true,status:'DISPUTA',protection:protectionForJob(job.id),demo:true });
});

app.get('/api/jobs/:id/protection', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (req.user.role !== 'admin' && job.client_id !== req.user.id && (!wp || wp.user_id !== req.user.id)) return res.status(403).json({ error:'Sin acceso' });
  const protection = protectionForJob(job.id);
  const events = protection ? db.prepare('SELECT * FROM payment_protection_events WHERE protection_id=? ORDER BY id').all(protection.id) : [];
  res.json({ protection, events, demo:true });
});

// Resolución administrativa DEMO. La integración real de pagos debe usar webhooks/idempotencia del proveedor.
app.post('/api/admin/jobs/:id/protection/resolve', auth, requireRole('admin'), (req,res) => {
  const action = String((req.body || {}).action || '');
  const resolution = String((req.body || {}).resolution || '').trim().slice(0,4000);
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const protection = protectionForJob(job.id) || createProtectionForJob(job);
  if (!['DISPUTED','CORRECTION'].includes(protection.status)) return res.status(409).json({ error:'El pago no está en disputa' });
  if (!['release','correction','refund','partial_refund'].includes(action)) return res.status(400).json({ error:'Resolución inválida' });
  if (!resolution) return res.status(400).json({ error:'La resolución es obligatoria' });

  if (action === 'correction') {
    db.prepare(\`UPDATE payment_protections SET status='CORRECTION',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?\`).run(resolution,req.user.id,job.id);
    addProtectionEvent(protection.id,'correction_requested',req.user.id,{ resolution });
    notify(job.worker_id ? db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id).user_id : null,'disputa','DatoYa solicitó una corrección del trabajo.','#/trabajos');
  } else if (action === 'release') {
    finalizeProtectedJob({ ...job, status:'DISPUTA' }, req.user.id);
    db.prepare(\`UPDATE payment_protections SET resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?\`).run(resolution,req.user.id,job.id);
    addProtectionEvent(protection.id,'admin_release',req.user.id,{ resolution });
  } else {
    const status = action === 'refund' ? 'REFUNDED' : 'PARTIAL_REFUND';
    db.prepare(\`UPDATE payment_protections SET status=?,resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?\`).run(status,resolution,req.user.id,job.id);
    db.prepare(\`UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=?\`).run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
    addProtectionEvent(protection.id,action === 'refund' ? 'refund' : 'partial_refund',req.user.id,{ resolution, demo:true });
    const amount = action === 'refund' ? protection.service_amount : Math.floor(protection.service_amount / 2);
    db.prepare('INSERT INTO ledger_entries(user_id,job_id,payment_id,type,amount,reference,metadata) VALUES(?,?,?,?,?,?,?)').run(job.client_id,job.id,null,'REEMBOLSO',-amount,'datoya_protection_demo_refund',JSON.stringify({ demo:true, action, resolution }));
    notify(job.client_id,'pago',action === 'refund' ? 'La resolución contempla un reembolso DEMO.' : 'La resolución contempla un reembolso parcial DEMO.','#/trabajos');
  }
  res.json({ ok:true, protection:protectionForJob(job.id), demo:true });
});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === path.resolve(serverFile) && typeof value === 'string') return injectProtection(value);
  return value;
};

try {
  require('./demo_bootstrap');
} finally {
  fs.readFileSync = originalReadFileSync;
}

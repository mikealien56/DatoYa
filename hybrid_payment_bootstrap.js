// DatoYa — flujo híbrido de pago protegido (TEST).
// Trabajos cortos: garantía previa simulada en TEST; trabajos largos: pago al finalizar.
// No mueve dinero real. La captura/autorización real de proveedor externo se habilitará solo
// cuando la modalidad comercial y la distribución de costos estén confirmadas.
const fs = require('fs');
const path = require('path');

const previousReadFileSync = fs.readFileSync;
const serverFile = path.resolve(__dirname, 'server.js');

function injectHybridPayment(source) {
  const marker = '// ============ AUTH ============';
  const sentinel = '// DATOYA HYBRID PAYMENT FLOW V1';
  if (!source.includes(marker)) throw new Error('No se encontró AUTH para montar el flujo híbrido de pagos');
  if (source.includes(sentinel)) return source;

  const block = `
// DATOYA HYBRID PAYMENT FLOW V1
// Este flujo es TEST: representa autorización/captura sin mover dinero real.
db.exec(
  "CREATE TABLE IF NOT EXISTS job_payment_workflows (" +
  "job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE," +
  "mode TEXT NOT NULL," +
  "state TEXT NOT NULL," +
  "duration_days INTEGER," +
  "authorization_status TEXT," +
  "authorization_expires_at TEXT," +
  "work_marked_done_at TEXT," +
  "review_deadline TEXT," +
  "payment_requested_at TEXT," +
  "paid_at TEXT," +
  "provider_payment_id TEXT," +
  "created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  "updated_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_job_payment_workflows_state ON job_payment_workflows(state);"
);

function dyHybridParseDurationDays(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const nMatch = raw.match(/(\\d+(?:[.,]\\d+)?)/);
  const n = nMatch ? Number(nMatch[1].replace(',', '.')) : 1;
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/hora|minuto/.test(raw)) return 1;
  if (/d[ií]a/.test(raw)) return Math.max(1, Math.ceil(n));
  if (/semana/.test(raw)) return Math.max(1, Math.ceil(n * 7));
  if (/mes/.test(raw)) return Math.max(1, Math.ceil(n * 30));
  return null;
}
function dyHybridThresholdDays() {
  const n = Number(process.env.DATOYA_PREAUTH_MAX_DAYS || 5);
  return Number.isFinite(n) && n > 0 ? Math.min(7, Math.floor(n)) : 5;
}
function dyHybridAuthDays() {
  const n = Number(process.env.DATOYA_PREAUTH_AUTH_DAYS || 7);
  return Number.isFinite(n) && n > 0 ? Math.min(7, Math.floor(n)) : 7;
}
function dyHybridEnforced() {
  return ['1','true','yes','on'].includes(String(process.env.DATOYA_HYBRID_ENFORCE || '').toLowerCase());
}
function dyHybridFlow(jobId) {
  return db.prepare('SELECT * FROM job_payment_workflows WHERE job_id=?').get(jobId);
}
function dyHybridJobAccess(req, job) {
  if (!job) return false;
  const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  return req.user.role === 'admin' || job.client_id === req.user.id || !!(wp && wp.user_id === req.user.id);
}
function dyHybridEnsure(job) {
  let flow = dyHybridFlow(job.id);
  if (flow) return flow;
  const q = db.prepare('SELECT duration_estimate FROM quotes WHERE id=?').get(job.quote_id);
  const days = dyHybridParseDurationDays(q && q.duration_estimate);
  const mode = days !== null && days <= dyHybridThresholdDays() ? 'PREAUTH_SHORT' : 'PAY_ON_COMPLETION';
  const state = mode === 'PREAUTH_SHORT' ? 'PREAUTH_REQUIRED' : 'WORK_ALLOWED';
  db.prepare('INSERT INTO job_payment_workflows(job_id,mode,state,duration_days) VALUES(?,?,?,?)').run(job.id, mode, state, days);
  try {
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'payment_flow_created',job.client_id,JSON.stringify({mode,duration_days:days,test:true}));
  } catch (_) {}
  return dyHybridFlow(job.id);
}
function dyHybridIsAuthValid(flow) {
  if (!flow || flow.authorization_status !== 'AUTHORIZED_TEST' || !flow.authorization_expires_at) return false;
  const t = new Date(String(flow.authorization_expires_at).replace(' ','T')).getTime();
  return Number.isFinite(t) && t > Date.now();
}
function dyHybridRefresh(flow) {
  if (!flow || flow.mode !== 'PREAUTH_SHORT') return flow;
  if (flow.authorization_status === 'AUTHORIZED_TEST' && !dyHybridIsAuthValid(flow) && !['PAID_TEST','DISPUTED'].includes(flow.state)) {
    const nextState = flow.work_marked_done_at ? 'AWAITING_AUTHORIZATION' : 'AUTH_EXPIRED';
    db.prepare("UPDATE job_payment_workflows SET state=?,authorization_status='EXPIRED_TEST',updated_at=datetime('now') WHERE job_id=?").run(nextState,flow.job_id);
    return dyHybridFlow(flow.job_id);
  }
  return flow;
}
function dyHybridDeadline() {
  const hours = Number(getSetting('protection_review_hours','24')) || 24;
  return new Date(Date.now() + Math.max(1,hours) * 3600000).toISOString().slice(0,19).replace('T',' ');
}

// Se crea el flujo apenas se acepta la cotización.
app.use('/api/quotes/:id/accept', auth, (req,res,next) => {
  const quoteId = Number(req.params.id);
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    try {
      const job = db.prepare('SELECT * FROM jobs WHERE quote_id=?').get(quoteId);
      if (job) dyHybridEnsure(job);
    } catch (e) { console.error('[DatoYa][Pago híbrido][aceptar]', e.message); }
  });
  next();
});

// Opcionalmente impide iniciar un trabajo corto sin garantía previa.
// Se activa en Render con DATOYA_HYBRID_ENFORCE=1; CI/legacy permanece compatible por defecto.
app.use('/api/jobs/:id/status', auth, (req,res,next) => {
  if (String((req.body || {}).status || '') !== 'EN_PROCESO' || !dyHybridEnforced()) return next();
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({error:'Trabajo no encontrado'});
  let flow = dyHybridRefresh(dyHybridEnsure(job));
  if (flow.mode === 'PREAUTH_SHORT' && !dyHybridIsAuthValid(flow)) {
    return res.status(409).json({error:'Este trabajo corto necesita garantía de pago antes de comenzar. El cliente debe completar “Garantizar pago”.',payment_flow:flow});
  }
  next();
});

app.get('/api/jobs/:id/payment-flow', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if (!dyHybridJobAccess(req,job)) return res.status(403).json({error:'Sin acceso'});
  const flow = dyHybridRefresh(dyHybridEnsure(job));
  res.json({
    flow,
    test_mode:true,
    real_money:false,
    real_capture_enabled:false,
    enforced:dyHybridEnforced(),
    short_job_max_days:dyHybridThresholdDays(),
    authorization_max_days:dyHybridAuthDays(),
    message:'Flujo de prueba: no autoriza ni cobra dinero real.'
  });
});

// Simula en TEST la autorización de un trabajo corto. No llama a proveedor externo.
app.post('/api/jobs/:id/payment-flow/authorize-test', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if (job.client_id !== req.user.id) return res.status(403).json({error:'Solo el cliente puede garantizar el pago'});
  let flow = dyHybridRefresh(dyHybridEnsure(job));
  if (flow.mode !== 'PREAUTH_SHORT') return res.status(409).json({error:'Este trabajo usa pago al finalizar, no requiere garantía previa'});
  if (['PAID_TEST','DISPUTED'].includes(flow.state)) return res.status(409).json({error:'Este flujo ya no admite una nueva garantía'});
  const expires = new Date(Date.now() + dyHybridAuthDays()*86400000).toISOString().slice(0,19).replace('T',' ');
  const state = flow.work_marked_done_at ? 'AWAITING_CLIENT_APPROVAL' : 'AUTHORIZED_TEST';
  db.prepare("UPDATE job_payment_workflows SET state=?,authorization_status='AUTHORIZED_TEST',authorization_expires_at=?,updated_at=datetime('now') WHERE job_id=?").run(state,expires,job.id);
  try { db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'payment_authorized_test',req.user.id,JSON.stringify({expires_at:expires,test:true})); } catch (_) {}
  const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (wp) notify(wp.user_id,'pago','El cliente garantizó el pago en MODO TEST. Ya puedes continuar con el trabajo.','#/trabajos');
  res.json({ok:true,flow:dyHybridFlow(job.id),test_mode:true,real_money:false});
});

// Después de que el endpoint existente marca el trabajo como terminado,
// el flujo cambia a revisión/cobro según sea corto o largo.
app.use('/api/jobs/:id/complete-request', auth, (req,res,next) => {
  const jobId = Number(req.params.id);
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    try {
      const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
      if (!job) return;
      let flow = dyHybridRefresh(dyHybridEnsure(job));
      if (['PAID_TEST','DISPUTED'].includes(flow.state)) return;
      const deadline = dyHybridDeadline();
      let state;
      if (flow.mode === 'PREAUTH_SHORT') state = dyHybridIsAuthValid(flow) ? 'AWAITING_CLIENT_APPROVAL' : 'AWAITING_AUTHORIZATION';
      else state = 'AWAITING_PAYMENT';
      db.prepare("UPDATE job_payment_workflows SET state=?,work_marked_done_at=datetime('now'),payment_requested_at=datetime('now'),review_deadline=?,updated_at=datetime('now') WHERE job_id=?").run(state,deadline,job.id);
    } catch (e) { console.error('[DatoYa][Pago híbrido][terminado]', e.message); }
  });
  next();
});

// Sin liberación automática: si vence la revisión el flujo sigue pendiente.
app.use('/api/jobs/:id/status', auth, (req,res,next) => {
  if (String((req.body || {}).status || '') !== 'DISPUTA') return next();
  const jobId = Number(req.params.id);
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    try {
      const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
      if (!job) return;
      dyHybridEnsure(job);
      db.prepare("UPDATE job_payment_workflows SET state='DISPUTED',updated_at=datetime('now') WHERE job_id=?").run(job.id);
    } catch (_) {}
  });
  next();
});

// Aprobación final TEST. Para corto equivale a capturar la autorización simulada;
// para largo equivale a pagar después de revisar. No mueve dinero real.
app.post('/api/jobs/:id/payment-flow/approve-test', auth, (req,res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if (job.client_id !== req.user.id) return res.status(403).json({error:'Solo el cliente puede aprobar y pagar'});
  if (['FINALIZADO','CANCELADO','DISPUTA'].includes(job.status)) return res.status(409).json({error:'Este trabajo no admite el pago en su estado actual'});
  let flow = dyHybridRefresh(dyHybridEnsure(job));
  if (!flow.work_marked_done_at) return res.status(409).json({error:'El profesional todavía no ha marcado el trabajo como listo para revisión'});
  if (flow.mode === 'PREAUTH_SHORT' && !dyHybridIsAuthValid(flow)) return res.status(409).json({error:'La garantía TEST no está vigente. Vuelve a garantizar el pago antes de aprobar.',payment_flow:flow});
  if (!['AWAITING_CLIENT_APPROVAL','AWAITING_PAYMENT'].includes(flow.state)) return res.status(409).json({error:'El flujo de pago no está esperando aprobación',payment_flow:flow});

  const commission = Number(job.commission_amount || Math.round(Number(job.price||0)*Number(job.commission_pct||10)/100));
  const workerAmount = Math.max(0, Number(job.price||0) - commission);
  const providerId = 'test_hybrid_' + job.id + '_' + Date.now();
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const protection = (()=>{try{return db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);}catch(_){return null;}})();

  db.transaction(() => {
    db.prepare("UPDATE jobs SET status='FINALIZADO',worker_amount=?,updated_at=datetime('now') WHERE id=?").run(workerAmount,job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
    if (!db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id)) {
      db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'datoya_test','TEST_HYBRID','test_paid_after_approval')").run(job.id,job.price,commission,workerAmount);
    }
    if (!db.prepare('SELECT id FROM commissions WHERE job_id=?').get(job.id)) {
      db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id,job.commission_pct,commission);
    }
    if (job.status !== 'FINALIZADO') db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
    db.prepare("UPDATE job_payment_workflows SET state='PAID_TEST',authorization_status=?,paid_at=datetime('now'),provider_payment_id=?,updated_at=datetime('now') WHERE job_id=?")
      .run(flow.mode === 'PREAUTH_SHORT' ? 'CAPTURED_TEST' : 'PAID_AFTER_COMPLETION_TEST',providerId,job.id);
    if (protection) {
      db.prepare("UPDATE payment_protections SET status='RELEASED',released_at=datetime('now'),updated_at=datetime('now') WHERE job_id=?").run(job.id);
      try { db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(protection.id,'hybrid_test_payment_approved',req.user.id,JSON.stringify({mode:flow.mode,test:true})); } catch (_) {}
    }
    try { db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'hybrid_payment_approved_test',req.user.id,JSON.stringify({mode:flow.mode,amount:job.price,commission,worker_amount:workerAmount,test:true})); } catch (_) {}
  })();

  notify(job.client_id,'pago','Pago aprobado en MODO TEST. No se movió dinero real.','#/trabajos');
  if (wp) notify(wp.user_id,'pago','El cliente aprobó el trabajo en MODO TEST. Neto profesional simulado: '+fmtCLP(workerAmount)+'.','#/trabajos');
  res.json({ok:true,status:'FINALIZADO',flow:dyHybridFlow(job.id),breakdown:{amount:job.price,datoya_fee:commission,worker_amount:workerAmount},test_mode:true,real_money:false});
});
// =======================================================
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, ...args) {
  const out = previousReadFileSync.call(this, file, ...args);
  let resolved;
  try { resolved = path.resolve(String(file)); } catch (_) { return out; }
  if (resolved !== serverFile) return out;
  const text = Buffer.isBuffer(out) ? out.toString('utf8') : String(out);
  const injected = injectHybridPayment(text);
  return Buffer.isBuffer(out) ? Buffer.from(injected,'utf8') : injected;
};

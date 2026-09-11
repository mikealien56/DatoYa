// DatoYa DEMO — arranque con parches de seguridad backend sin alterar server.js.
// Este archivo mantiene la versión original intacta y aplica los controles antes de cargarla.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const filename = path.join(__dirname, 'server.js');
let source = fs.readFileSync(filename, 'utf8');

const requestDetailStart = "app.get('/api/requests/:id', auth, (req, res) => {";
const quotesMarker = "// ============ COTIZACIONES ============";
const requestDetailReplacement = `app.get('/api/requests/:id', auth, (req, res) => {
  const r = db.prepare(\`SELECT sr.*, c.name AS category, c.icon, co.name AS comuna, u.name AS client_name, u.id AS client_user_id
    FROM service_requests sr JOIN categories c ON c.id=sr.category_id LEFT JOIN comunas co ON co.id=sr.comuna_id JOIN users u ON u.id=sr.client_id WHERE sr.id=?\`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const isOwner = r.client_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  const wp = req.user.role === 'trabajador' ? getWorkerByUser(req.user.id) : null;
  const isWorker = !!wp;
  if (!isOwner && !isWorker && !isAdmin) return res.status(403).json({ error: 'Sin acceso' });
  if (isWorker && !isOwner && !isAdmin) {
    if (wp.status !== 'disponible') return res.status(403).json({ error: 'Tu perfil no está disponible para nuevas solicitudes' });
    const categoryMatch = db.prepare('SELECT 1 FROM worker_categories WHERE worker_id=? AND category_id=?').get(wp.id, r.category_id);
    if (!categoryMatch) return res.status(403).json({ error: 'No eres compatible con la categoría de esta solicitud' });
    if (r.comuna_id) {
      const zoneMatch = wp.comuna_id === r.comuna_id || !!db.prepare('SELECT 1 FROM worker_comunas WHERE worker_id=? AND comuna_id=?').get(wp.id, r.comuna_id);
      if (!zoneMatch) return res.status(403).json({ error: 'Esta solicitud está fuera de tu zona de trabajo' });
    }
  }
  let quotes;
  if (isOwner || isAdmin) {
    quotes = db.prepare(\`SELECT q.*, wp.rating_avg, wp.rating_count, wp.jobs_completed, wp.verified_identity, wp.is_pro,
      u.name AS worker_name, wp.id AS worker_profile_id, co.name AS worker_comuna, wp.status AS worker_status
      FROM quotes q JOIN worker_profiles wp ON wp.id=q.worker_id JOIN users u ON u.id=wp.user_id
      LEFT JOIN comunas co ON co.id=wp.comuna_id WHERE q.request_id=? ORDER BY q.created_at\`).all(req.params.id);
  } else {
    quotes = db.prepare(\`SELECT q.*, wp.rating_avg, wp.rating_count, wp.jobs_completed, wp.verified_identity, wp.is_pro,
      u.name AS worker_name, wp.id AS worker_profile_id, co.name AS worker_comuna, wp.status AS worker_status
      FROM quotes q JOIN worker_profiles wp ON wp.id=q.worker_id JOIN users u ON u.id=wp.user_id
      LEFT JOIN comunas co ON co.id=wp.comuna_id WHERE q.request_id=? AND q.worker_id=? ORDER BY q.created_at\`).all(req.params.id, wp.id);
    delete r.address_detail;
    r.client_name = r.client_name.split(' ')[0];
  }
  res.json({ request: r, quotes, is_owner: isOwner });
});

`;
const startIndex = source.indexOf(requestDetailStart);
const endIndex = source.indexOf(quotesMarker, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('No se encontró el endpoint de detalle de solicitud');
source = source.slice(0, startIndex) + requestDetailReplacement + source.slice(endIndex);

const quoteGuard = "if (!reqRow || reqRow.status !== 'abierta') return res.status(400).json({ error: 'La solicitud ya no está disponible' });";
const quoteGuardReplacement = `if (!reqRow || reqRow.status !== 'abierta') return res.status(400).json({ error: 'La solicitud ya no está disponible' });
  if (wp.status !== 'disponible') return res.status(400).json({ error: 'Tu perfil no está disponible para nuevas solicitudes' });
  const categoryMatch = db.prepare('SELECT 1 FROM worker_categories WHERE worker_id=? AND category_id=?').get(wp.id, reqRow.category_id);
  if (!categoryMatch) return res.status(403).json({ error: 'No eres compatible con la categoría de esta solicitud' });
  if (reqRow.comuna_id) {
    const zoneMatch = wp.comuna_id === reqRow.comuna_id || !!db.prepare('SELECT 1 FROM worker_comunas WHERE worker_id=? AND comuna_id=?').get(wp.id, reqRow.comuna_id);
    if (!zoneMatch) return res.status(403).json({ error: 'Esta solicitud está fuera de tu zona de trabajo' });
  }`;
if (!source.includes(quoteGuard)) throw new Error('No se encontró la validación de cotización');
source = source.replace(quoteGuard, quoteGuardReplacement);

const jobsStart = "app.post('/api/jobs/:id/status', auth, (req, res) => {";
const adminMarker = "// ============ ADMIN ============";
const jobsStartIndex = source.indexOf(jobsStart);
const adminIndex = source.indexOf(adminMarker, jobsStartIndex);
if (jobsStartIndex < 0 || adminIndex < 0) throw new Error('No se encontró el endpoint de estados de trabajo');
const jobsReplacement = `app.post('/api/jobs/:id/status', auth, (req, res) => {
  const { status } = req.body || {};
  const valid = ['CONFIRMADO', 'EN_PROCESO', 'FINALIZADO', 'CANCELADO', 'DISPUTA'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isWorker = !!wp && wp.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isClient && !isWorker && !isAdmin) return res.status(403).json({ error: 'Sin acceso' });
  const allowed = {
    TRABAJADOR_SELECCIONADO: ['CONFIRMADO', 'CANCELADO', 'DISPUTA'],
    CONFIRMADO: ['EN_PROCESO', 'CANCELADO', 'DISPUTA'],
    EN_PROCESO: ['FINALIZADO', 'CANCELADO', 'DISPUTA'],
    FINALIZADO: [],
    CANCELADO: [],
    DISPUTA: ['CANCELADO']
  };
  if (!allowed[job.status] || !allowed[job.status].includes(status)) return res.status(409).json({ error: \`Transición no permitida: \${job.status} → \${status}\` });
  if (status === 'CONFIRMADO' && !isWorker && !isAdmin) return res.status(403).json({ error: 'El trabajador debe confirmar el trabajo' });
  if (status === 'EN_PROCESO' && !isWorker && !isAdmin) return res.status(403).json({ error: 'Solo el trabajador puede iniciar el trabajo' });
  if (status === 'FINALIZADO' && !isClient && !isAdmin) return res.status(403).json({ error: 'Solo el cliente puede marcar el trabajo como terminado' });
  const tx = db.transaction(() => {
    db.prepare(\`UPDATE jobs SET status=?, updated_at=datetime('now') WHERE id=?\`).run(status, job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id, status, req.user.id);
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id, 'status_changed', req.user.id, JSON.stringify({ from: job.status, to: status }));
    if (status === 'FINALIZADO') {
      db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
      const alreadyPaid = db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id);
      if (!alreadyPaid) {
        db.prepare(\`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_completado')\`)
          .run(job.id, job.price, job.commission_amount, job.worker_amount);
        db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id, job.commission_pct, job.commission_amount);
        db.prepare('INSERT INTO ledger_entries(user_id,job_id,payment_id,type,amount,reference,metadata) SELECT ?,job_id,last_insert_rowid(),\'COMISION\',?,?,? FROM payments WHERE job_id=? ORDER BY id DESC LIMIT 1')
          .run(req.user.id, job.commission_amount, 'datoYa_commission', JSON.stringify({ pct: job.commission_pct, demo: true }), job.id);
      }
      notify(job.client_id, 'pago', \`Trabajo finalizado. Pago registrado en MODO DEMO: \${fmtCLP(job.price)}. Recuerda calificar.\`, '#/trabajos');
      notify(wp.user_id, 'pago', \`Trabajo finalizado. Recibirás \${fmtCLP(job.worker_amount)} (comisión DatoYa \${fmtCLP(job.commission_amount)}). MODO DEMO.\`, '#/trabajos');
    } else {
      const target = isClient ? wp.user_id : job.client_id;
      notify(target, 'trabajo', \`El trabajo cambió a estado: \${status}.\`, '#/trabajos');
    }
  });
  tx();
  res.json({ ok: true, status, demo: true });
});

`;
source = source.slice(0, jobsStartIndex) + jobsReplacement + source.slice(adminIndex);

// Controles transversales y endpoints de operaciones avanzadas.
const advancedRoutes = `
// ============ HARDENING OPERATIVO ============
const rateBuckets = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = String(req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    let b = rateBuckets.get(key);
    if (!b || now - b.start >= windowMs) b = { start: now, count: 0 };
    b.count += 1;
    rateBuckets.set(key, b);
    if (b.count > max) return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' });
    next();
  };
}
app.use('/api/auth/login', rateLimit(60 * 1000, 12));
app.use('/api/auth/register', rateLimit(60 * 1000, 8));

// Auditoría mínima de mutaciones autenticadas. Nunca guarda contraseñas ni tokens.
app.use('/api', (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (!req.user || !['POST','PUT','PATCH','DELETE'].includes(req.method)) return;
    try {
      db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,metadata,ip,user_agent) VALUES(?,?,?,?,?,?)')
        .run(req.user.id, req.method + ' ' + req.path, 'api', JSON.stringify({ status: res.statusCode, duration_ms: Date.now() - started }), req.ip || null, req.get('user-agent') || null);
    } catch (_) {}
  });
  next();
});

function jobAccess(req, res, next) {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  const wp = getWorkerByUser(req.user.id);
  if (req.user.role !== 'admin' && job.client_id !== req.user.id && (!wp || wp.id !== job.worker_id)) return res.status(403).json({ error: 'Sin acceso' });
  req.job = job;
  next();
}

app.get('/api/jobs/:id/events', auth, jobAccess, (req, res) => {
  res.json({ events: db.prepare('SELECT * FROM job_events WHERE job_id=? ORDER BY id').all(req.job.id) });
});
app.post('/api/jobs/:id/events', auth, jobAccess, (req, res) => {
  const { event_type, latitude, longitude, accuracy, metadata } = req.body || {};
  const allowed = ['en_camino','permiso_gps','llegada','status_changed','nota'];
  if (!allowed.includes(event_type)) return res.status(400).json({ error: 'Evento inválido' });
  if (['en_camino','llegada'].includes(event_type) && req.user.role !== 'admin') {
    const wp = getWorkerByUser(req.user.id);
    if (!wp || wp.id !== req.job.worker_id) return res.status(403).json({ error: 'Solo el trabajador puede registrar este evento' });
  }
  if (['llegada'].includes(event_type) && (latitude == null || longitude == null)) return res.status(400).json({ error: 'La llegada requiere ubicación' });
  const id = db.prepare('INSERT INTO job_events(job_id,event_type,user_id,latitude,longitude,accuracy,metadata) VALUES(?,?,?,?,?,?,?)')
    .run(req.job.id, event_type, req.user.id, latitude ?? null, longitude ?? null, accuracy ?? null, metadata ? JSON.stringify(metadata) : null).lastInsertRowid;
  res.status(201).json({ ok: true, id });
});

app.get('/api/jobs/:id/photos', auth, jobAccess, (req, res) => {
  res.json({ photos: db.prepare('SELECT id,job_id,user_id,phase,storage_key,is_private,created_at FROM job_photos WHERE job_id=? ORDER BY id').all(req.job.id) });
});
app.post('/api/jobs/:id/photos', auth, jobAccess, (req, res) => {
  const { phase, storage_key, is_private = 1 } = req.body || {};
  if (!['problema','antes','durante','final'].includes(phase)) return res.status(400).json({ error: 'Fase de foto inválida' });
  if (!storage_key || typeof storage_key !== 'string' || storage_key.length > 500) return res.status(400).json({ error: 'Referencia de foto inválida' });
  const max = Number(getSetting('max_job_photos') || 20);
  const count = db.prepare('SELECT COUNT(*) c FROM job_photos WHERE job_id=?').get(req.job.id).c;
  if (count >= max) return res.status(400).json({ error: 'Límite de fotos alcanzado' });
  const id = db.prepare('INSERT INTO job_photos(job_id,user_id,phase,storage_key,is_private) VALUES(?,?,?,?,?)').run(req.job.id, req.user.id, phase, storage_key, is_private ? 1 : 0).lastInsertRowid;
  res.status(201).json({ ok: true, id });
});

// Documentos de verificación: solo el propio profesional y administración pueden consultarlos.
app.get('/api/worker/verification/documents', auth, (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  if (req.user.role !== 'admin' && !wp) return res.status(403).json({ error: 'Sin acceso' });
  const rows = db.prepare(\`SELECT vd.id,vd.document_type,vd.status,vd.created_at,vr.worker_id
    FROM verification_documents vd JOIN verification_requests vr ON vr.id=vd.verification_request_id
    WHERE vr.worker_id=? ORDER BY vd.id DESC\`).all(wp ? wp.id : -1);
  res.json({ documents: rows });
});

app.post('/api/incidents', auth, (req, res) => {
  const { job_id, target_user_id, type, details } = req.body || {};
  const valid = ['no_show','cancelacion','conducta','fraude','danos','incumplimiento','otro'];
  if (!valid.includes(type) || !details) return res.status(400).json({ error: 'Tipo y detalles son obligatorios' });
  if (job_id) {
    const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(job_id);
    const wp = getWorkerByUser(req.user.id);
    if (!job || (req.user.role !== 'admin' && job.client_id !== req.user.id && (!wp || wp.id !== job.worker_id))) return res.status(403).json({ error: 'Sin acceso al trabajo' });
  }
  const id = db.prepare('INSERT INTO incidents(reporter_id,job_id,target_user_id,type,details) VALUES(?,?,?,?,?)').run(req.user.id, job_id || null, target_user_id || null, type, String(details).slice(0, 4000)).lastInsertRowid;
  res.status(201).json({ ok: true, id, status: 'pendiente' });
});
app.get('/api/incidents', auth, (req, res) => {
  if (req.user.role === 'admin') return res.json({ incidents: db.prepare('SELECT * FROM incidents ORDER BY id DESC').all() });
  res.json({ incidents: db.prepare('SELECT * FROM incidents WHERE reporter_id=? ORDER BY id DESC').all(req.user.id) });
});
app.post('/api/admin/incidents/:id/resolve', auth, requireRole('admin'), (req, res) => {
  const { status, resolution } = req.body || {};
  if (!['en_revision','confirmado','rechazado','apelado','cerrado'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const result = db.prepare(`UPDATE incidents SET status=?,resolution=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?`).run(status, resolution || null, req.user.id, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Incidente no encontrado' });
  res.json({ ok: true });
});

app.post('/api/appeals', auth, (req, res) => {
  const { sanction_id, incident_id, reason, evidence } = req.body || {};
  if (!reason) return res.status(400).json({ error: 'Motivo obligatorio' });
  if (sanction_id) {
    const s = db.prepare('SELECT user_id FROM sanctions WHERE id=?').get(sanction_id);
    if (!s) return res.status(404).json({ error: 'Sanción no encontrada' });
    if (s.user_id !== req.user.id) return res.status(403).json({ error: 'No puedes apelar una sanción ajena' });
  }
  const id = db.prepare('INSERT INTO appeals(user_id,sanction_id,incident_id,reason,evidence) VALUES(?,?,?,?,?)').run(req.user.id, sanction_id || null, incident_id || null, String(reason).slice(0, 4000), evidence ? String(evidence).slice(0, 4000) : null).lastInsertRowid;
  res.status(201).json({ ok: true, id, status: 'pendiente' });
});
app.get('/api/appeals', auth, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM appeals ORDER BY id DESC').all()
    : db.prepare('SELECT * FROM appeals WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  res.json({ appeals: rows });
});
app.post('/api/admin/appeals/:id/resolve', auth, requireRole('admin'), (req, res) => {
  const { status, resolution } = req.body || {};
  if (!['en_revision','aceptada','rechazada','cerrada'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const result = db.prepare(`UPDATE appeals SET status=?,resolution=?,reviewed_by=?,reviewed_at=datetime('now') WHERE id=?`).run(status, resolution || null, req.user.id, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Apelación no encontrada' });
  res.json({ ok: true });
});

app.get('/api/ledger', auth, (req, res) => {
  if (req.user.role === 'admin') return res.json({ entries: db.prepare('SELECT * FROM ledger_entries ORDER BY id DESC LIMIT 500').all() });
  const wp = getWorkerByUser(req.user.id);
  res.json({ entries: db.prepare('SELECT * FROM ledger_entries WHERE user_id=? ORDER BY id DESC LIMIT 200').all(wp ? req.user.id : req.user.id) });
});
app.get('/api/admin/audit', auth, requireRole('admin'), (req, res) => {
  res.json({ logs: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all() });
});

`;
source = source.replace("// ============ ADMIN ============", advancedRoutes + "// ============ ADMIN ============");
if (!source.includes('const rateBuckets = new Map();')) throw new Error('No se pudo insertar hardening operativo');

// Render exige que el proceso web escuche en 0.0.0.0 y en PORT.
const listenMarker = "app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:${PORT}`));";
const listenReplacement = "app.get('/health', (req, res) => res.status(200).json({ ok: true, service: 'datoya' }));\napp.listen(PORT, '0.0.0.0', () => console.log(`[DatoYa] Servidor corriendo en 0.0.0.0:${PORT}`));";
if (!source.includes(listenMarker)) throw new Error('No se encontró el arranque HTTP de DatoYa');
source = source.replace(listenMarker, listenReplacement);

const patched = new Module(filename, module.parent);
patched.filename = filename;
patched.paths = Module._nodeModulePaths(__dirname);
patched._compile(source, filename);

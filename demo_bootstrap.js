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

  // Regla crítica DatoYa: cliente/admin pueden ver todas las cotizaciones;
  // cada trabajador solo puede ver la suya. Esto también bloquea IDOR por URL/API.
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

// Una cotización solo puede enviarse a una solicitud compatible con categoría y zona.
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

// Máquina de estados DEMO: no se permiten saltos arbitrarios.
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
  if (!allowed[job.status] || !allowed[job.status].includes(status)) {
    return res.status(409).json({ error: \`Transición no permitida: \${job.status} → \${status}\` });
  }
  if (status === 'CONFIRMADO' && !isWorker && !isAdmin) return res.status(403).json({ error: 'El trabajador debe confirmar el trabajo' });
  if (status === 'EN_PROCESO' && !isWorker && !isAdmin) return res.status(403).json({ error: 'Solo el trabajador puede iniciar el trabajo' });
  if (status === 'FINALIZADO' && !isClient && !isAdmin) return res.status(403).json({ error: 'Solo el cliente puede marcar el trabajo como terminado' });

  const tx = db.transaction(() => {
    db.prepare(\`UPDATE jobs SET status=?, updated_at=datetime('now') WHERE id=?\`).run(status, job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id, status, req.user.id);
    if (status === 'FINALIZADO') {
      db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
      // Pago DEMO: no mueve dinero real.
      const alreadyPaid = db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id);
      if (!alreadyPaid) {
        db.prepare(\`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_completado')\`)
          .run(job.id, job.price, job.commission_amount, job.worker_amount);
        db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id, job.commission_pct, job.commission_amount);
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

const patched = new Module(filename, module.parent);
patched.filename = filename;
patched.paths = Module._nodeModulePaths(__dirname);
patched._compile(source, filename);

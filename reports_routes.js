// CI: validar nuevamente el flujo completo sobre este commit.
// DatoYa 2.0 — Rutas del expediente administrativo de denuncias
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.status(200).json({ ok: true, service: 'datoya', status: 'healthy' });
  } catch (_) {
    res.status(503).json({ ok: false, service: 'datoya', status: 'unhealthy' });
  }
});

function reportPartyContext(report) {
  let targetUserId = null, jobId = null, requestId = null, reviewId = null;
  if (report.target_type === 'usuario') targetUserId = report.target_id;
  else if (report.target_type === 'resena') {
    reviewId = report.target_id;
    const review = db.prepare('SELECT reviewee_id, job_id FROM reviews WHERE id=?').get(report.target_id);
    if (review) { targetUserId = review.reviewee_id; jobId = review.job_id; }
  } else if (report.target_type === 'trabajo') {
    jobId = report.target_id;
    const job = db.prepare('SELECT id, request_id, client_id, worker_id FROM jobs WHERE id=?').get(report.target_id);
    if (job) {
      requestId = job.request_id;
      const worker = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
      targetUserId = report.reporter_id === job.client_id ? (worker ? worker.user_id : null) : job.client_id;
    }
  }
  if (jobId && !requestId) {
    const job = db.prepare('SELECT request_id FROM jobs WHERE id=?').get(jobId);
    requestId = job ? job.request_id : null;
  }
  return { targetUserId, jobId, requestId, reviewId };
}

function reportUserSummary(id) {
  if (!id) return null;
  return db.prepare('SELECT u.id, u.name, u.email, u.role, u.is_active, c.name AS comuna, wp.id AS worker_id, wp.oficio, wp.verified_identity, wp.is_pro, wp.rating_avg, wp.rating_count FROM users u LEFT JOIN comunas c ON c.id=u.comuna_id LEFT JOIN worker_profiles wp ON wp.user_id=u.id WHERE u.id=?').get(id) || null;
}

function reportRoleLabel(role) {
  return role === 'cliente' ? 'Cliente' : role === 'trabajador' ? 'Profesional' : role === 'admin' ? 'Administrador' : (role || 'No identificado');
}

function reportTableExists(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

app.get('/api/admin/reports', auth, requireRole('admin'), (req, res) => {
  const rows = db.prepare("SELECT r.*, reporter.name AS reporter_name, reporter.role AS reporter_role, target.name AS target_name, target.role AS target_role, CASE WHEN reporter.role='cliente' AND target.role='trabajador' THEN 'Cliente → Profesional' WHEN reporter.role='trabajador' AND target.role='cliente' THEN 'Profesional → Cliente' WHEN reporter.role='cliente' THEN 'Cliente → ' || COALESCE(target.role,'objetivo') WHEN reporter.role='trabajador' THEN 'Profesional → ' || COALESCE(target.role,'objetivo') ELSE COALESCE(reporter.role,'No identificado') || ' → ' || COALESCE(target.role,'objetivo') END AS direction FROM reports r JOIN users reporter ON reporter.id=r.reporter_id LEFT JOIN users target ON target.id = CASE WHEN r.target_type='usuario' THEN r.target_id WHEN r.target_type='resena' THEN (SELECT reviewee_id FROM reviews WHERE id=r.target_id) WHEN r.target_type='trabajo' THEN (SELECT CASE WHEN j.client_id=r.reporter_id THEN wp.user_id ELSE j.client_id END FROM jobs j JOIN worker_profiles wp ON wp.id=j.worker_id WHERE j.id=r.target_id) END ORDER BY r.created_at DESC").all();
  const reports = rows.map(r => {
    const ctx = reportPartyContext(r);
    const job = ctx.jobId ? db.prepare("SELECT j.id, j.request_id, j.status, j.price, j.created_at, u.name AS client_name, wp.user_id AS worker_user_id, wu.name AS worker_name, sr.title AS request_title, sr.description AS request_description, c.name AS comuna FROM jobs j JOIN users u ON u.id=j.client_id JOIN worker_profiles wp ON wp.id=j.worker_id JOIN users wu ON wu.id=wp.user_id LEFT JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE j.id=?").get(ctx.jobId) : null;
    const request = !job && ctx.requestId ? db.prepare("SELECT sr.id, sr.title, sr.description, sr.status, sr.created_at, u.name AS client_name, c.name AS comuna FROM service_requests sr JOIN users u ON u.id=sr.client_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE sr.id=?").get(ctx.requestId) : null;
    return { ...r, reporter: r.reporter_name, target_name: r.target_name || 'No identificado', target_role: r.target_role || '—', reporter_role_label: reportRoleLabel(r.reporter_role), target_role_label: reportRoleLabel(r.target_role), direction: r.direction, job, request };
  });
  res.json({ reports });
});

app.get('/api/admin/reports/:id/case', auth, requireRole('admin'), (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Denuncia no encontrada' });
  const ctx = reportPartyContext(report);
  const reporter = reportUserSummary(report.reporter_id);
  const target = reportUserSummary(ctx.targetUserId);
  const job = ctx.jobId ? db.prepare("SELECT j.*, u.name AS client_name, u.email AS client_email, wp.user_id AS worker_user_id, wp.oficio, wp.description AS worker_description, wp.verified_identity, wp.is_pro, wp.rating_avg, wp.rating_count, wu.name AS worker_name, sr.title AS request_title, sr.description AS request_description, sr.photos AS request_photos, sr.status AS request_status, sr.created_at AS request_created_at, c.name AS comuna FROM jobs j JOIN users u ON u.id=j.client_id JOIN worker_profiles wp ON wp.id=j.worker_id JOIN users wu ON wu.id=wp.user_id LEFT JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE j.id=?").get(ctx.jobId) : null;
  const request = ctx.requestId ? db.prepare("SELECT sr.*, c.name AS comuna, u.name AS client_name FROM service_requests sr JOIN users u ON u.id=sr.client_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE sr.id=?").get(ctx.requestId) : null;
  let messages = [];
  if (ctx.jobId || ctx.requestId) {
    const conversations = db.prepare(ctx.jobId ? 'SELECT id FROM conversations WHERE job_id=?' : 'SELECT id FROM conversations WHERE request_id=?').all(ctx.jobId || ctx.requestId);
    for (const c of conversations) messages.push(...db.prepare('SELECT m.id, m.body, m.blocked, m.created_at, u.name AS sender_name, u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at ASC').all(c.id));
    messages.sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
    messages = messages.slice(-100);
  }
  let review = null;
  if (ctx.reviewId) review = db.prepare('SELECT r.*, u.name AS reviewer_name, ru.name AS reviewee_name FROM reviews r JOIN users u ON u.id=r.reviewer_id JOIN users ru ON ru.id=r.reviewee_id WHERE r.id=?').get(ctx.reviewId);
  let photos = [];
  if (request && request.photos) { try { photos = JSON.parse(request.photos || '[]'); } catch (_) { photos = []; } }
  photos = photos.map((p, i) => ({ index: i + 1, mime_type: p.mime_type || p.mimeType || '', original_name: p.original_name || p.name || 'foto', size_bytes: p.size_bytes || 0 }));
  const history = ctx.jobId ? db.prepare('SELECT h.status, h.created_at, u.name AS changed_by_name FROM job_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.job_id=? ORDER BY h.created_at ASC').all(ctx.jobId) : [];
  const evidence = ctx.jobId && reportTableExists('job_evidence') ? db.prepare('SELECT e.id, e.job_id, e.uploader_user_id, e.stage, e.storage_key, e.original_name, e.mime_type, e.size_bytes, e.latitude, e.longitude, e.accuracy_m, e.note, e.created_at, u.name AS uploader_name, u.role AS uploader_role FROM job_evidence e LEFT JOIN users u ON u.id=e.uploader_user_id WHERE e.job_id=? ORDER BY e.created_at ASC, e.id ASC').all(ctx.jobId) : [];
  const jobEvents = ctx.jobId && reportTableExists('job_events') ? db.prepare('SELECT e.*, u.name AS actor_name, u.role AS actor_role FROM job_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.job_id=? ORDER BY e.created_at ASC, e.id ASC').all(ctx.jobId) : [];
  const dispute = ctx.jobId && reportTableExists('job_disputes') ? db.prepare('SELECT * FROM job_disputes WHERE job_id=? ORDER BY id DESC LIMIT 1').get(ctx.jobId) || null : null;
  const disputeEvents = dispute && reportTableExists('job_dispute_events') ? db.prepare('SELECT e.*, u.name AS actor_name, u.role AS actor_role FROM job_dispute_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.dispute_id=? ORDER BY e.created_at ASC, e.id ASC').all(dispute.id) : [];
  res.json({ report, direction: reporter && target ? (reporter.role === 'cliente' && target.role === 'trabajador' ? 'Cliente → Profesional' : reporter.role === 'trabajador' && target.role === 'cliente' ? 'Profesional → Cliente' : reportRoleLabel(reporter.role) + ' → ' + reportRoleLabel(target.role)) : '—', reporter, target, job, request, review, photos, evidence, messages, history, job_events:jobEvents, dispute, dispute_events:disputeEvents });
});

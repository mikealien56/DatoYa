// DatoYa — Servidor backend (API REST + frontend estático)
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const { db, hashPassword, verifyPassword, getSetting, setSetting, notify, seed } = require('./db');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

seed();

// ============ HELPERS ============
function auth(req, res, next) {
  const token = req.cookies.datoya_token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const s = db.prepare(`SELECT s.token, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at > datetime('now')`).get(token);
  if (!s) return res.status(401).json({ error: 'Sesión expirada' });
  if (!s.is_active) return res.status(403).json({ error: 'Cuenta suspendida. Contacta a soporte.' });
  req.user = s;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    next();
  };
}
function getWorkerByUser(userId) {
  return db.prepare('SELECT * FROM worker_profiles WHERE user_id=?').get(userId);
}
// Haversine: distancia en km entre dos comunas
function distanciaKm(c1, c2) {
  if (!c1 || !c2 || !c1.lat || !c2.lat) return null;
  const R = 6371, dLat = (c2.lat - c1.lat) * Math.PI / 180, dLng = (c2.lng - c1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
// Filtro anti-fraude: bloquea intercambio de datos de contacto antes de aceptar trabajo
function filtrarContacto(texto) {
  const patrones = [
    /(\+?56\s?)?9\s?\d{4}\s?\d{4}/g,                       // celulares chilenos
    /\b\d{8,9}\b/g,                                        // números largos
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,     // emails
    /(instagram|whatsapp|wsp|face(book)?|telegram|@)[\s.:]*[a-z0-9_.-]+/gi, // RRSS
    /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g                 // RUT
  ];
  let limpio = texto;
  let bloqueado = false;
  for (const p of patrones) {
    if (p.test(limpio)) { bloqueado = true; limpio = limpio.replace(p, '[dato protegido 🔒]'); }
  }
  return { limpio, bloqueado };
}
const fmtCLP = n => '$' + Number(n).toLocaleString('es-CL');

const WORKER_SELECT = `
  SELECT wp.*, u.name, u.phone IS NOT NULL AS has_phone, c.name AS comuna, c.lat, c.lng, r.name AS region
  FROM worker_profiles wp
  JOIN users u ON u.id = wp.user_id
  LEFT JOIN comunas c ON c.id = wp.comuna_id
  LEFT JOIN regions r ON r.id = c.region_id`;

// ============ AUTH ============
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, role, comuna_id } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' });
  const finalRole = role === 'trabajador' ? 'trabajador' : 'cliente';
  try {
    const id = db.prepare('INSERT INTO users(email,password_hash,name,phone,role,comuna_id) VALUES(?,?,?,?,?,?)')
      .run(email.toLowerCase().trim(), hashPassword(password), name.trim(), phone || null, finalRole, comuna_id || null).lastInsertRowid;
    if (finalRole === 'trabajador') {
      db.prepare(`INSERT INTO worker_profiles(user_id,oficio,description,comuna_id) VALUES(?,?,?,?)`)
        .run(id, 'Oficio por definir', '', comuna_id || null);
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))`).run(token, id);
    res.cookie('datoya_token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax' });
    notify(id, 'bienvenida', '¡Bienvenido/a a DatoYa! Completa tu perfil para partir.', '#/perfil');
    res.json({ ok: true, user: publicUser(id) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    throw e;
  }
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase().trim());
  if (!u || !verifyPassword(password || '', u.password_hash)) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  if (!u.is_active) return res.status(403).json({ error: 'Cuenta suspendida. Contacta a soporte.' });
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))`).run(token, u.id);
  res.cookie('datoya_token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax' });
  res.json({ ok: true, user: publicUser(u.id) });
});
app.post('/api/auth/logout', (req, res) => {
  if (req.cookies.datoya_token) db.prepare('DELETE FROM sessions WHERE token=?').run(req.cookies.datoya_token);
  res.clearCookie('datoya_token');
  res.json({ ok: true });
});
app.get('/api/auth/me', auth, (req, res) => {
  const user = publicUser(req.user.id);
  user.worker = getWorkerByUser(req.user.id) || null;
  if (user.worker) {
    user.worker.categories = db.prepare('SELECT c.* FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(user.worker.id);
    user.worker.comunas = db.prepare('SELECT c.id, c.name FROM worker_comunas wc JOIN comunas c ON c.id=wc.comuna_id WHERE wc.worker_id=?').all(user.worker.id);
  }
  user.unread_notifications = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL').get(req.user.id).c;
  res.json({ user });
});
function publicUser(id) {
  const u = db.prepare(`SELECT u.id,u.email,u.name,u.phone,u.role,u.is_demo,u.created_at,c.name AS comuna FROM users u LEFT JOIN comunas c ON c.id=u.comuna_id WHERE u.id=?`).get(id);
  return u;
}

// ============ CATÁLOGOS ============
app.get('/api/categories', (req, res) => {
  res.json({ categories: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM worker_categories wc WHERE wc.category_id=c.id) AS workers FROM categories c WHERE c.active=1 ORDER BY c.id`).all() });
});
app.get('/api/regions', (req, res) => {
  res.json({ regions: db.prepare('SELECT * FROM regions ORDER BY id').all() });
});
app.get('/api/comunas', (req, res) => {
  const { region_id } = req.query;
  const rows = region_id
    ? db.prepare('SELECT c.*, r.name AS region FROM comunas c JOIN regions r ON r.id=c.region_id WHERE c.region_id=? ORDER BY c.name').all(region_id)
    : db.prepare('SELECT c.*, r.name AS region FROM comunas c JOIN regions r ON r.id=c.region_id ORDER BY r.id, c.name').all();
  res.json({ comunas: rows });
});

// ============ TRABAJADORES / BÚSQUEDA ============
app.get('/api/workers', (req, res) => {
  const { q, category_id, comuna_id, region_id, status, min_rating, verified, max_price, featured } = req.query;
  let where = ['u.is_active=1'], params = [];
  if (q) { where.push('(u.name LIKE ? OR wp.oficio LIKE ? OR wp.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (category_id) { where.push('wp.id IN (SELECT worker_id FROM worker_categories WHERE category_id=?)'); params.push(category_id); }
  if (comuna_id) { where.push('(wp.comuna_id=? OR wp.id IN (SELECT worker_id FROM worker_comunas WHERE comuna_id=?))'); params.push(comuna_id, comuna_id); }
  if (region_id) { where.push('c.region_id=?'); params.push(region_id); }
  if (status) { where.push('wp.status=?'); params.push(status); }
  if (min_rating) { where.push('wp.rating_avg>=?'); params.push(min_rating); }
  if (verified === '1') { where.push('wp.verified_identity=1'); }
  if (max_price) { where.push('wp.price_from<=?'); params.push(max_price); }
  if (featured === '1') { where.push('wp.is_featured=1'); }

  // Orden: destacados y PRO primero, luego calificación
  const rows = db.prepare(`${WORKER_SELECT} WHERE ${where.join(' AND ')} ORDER BY wp.is_featured DESC, wp.is_pro DESC, wp.rating_avg DESC LIMIT 60`).all(...params);

  // Distancia aproximada si el usuario logueado tiene comuna
  let userComuna = null;
  const token = req.cookies.datoya_token;
  if (token) {
    const s = db.prepare(`SELECT u.comuna_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(token);
    if (s && s.comuna_id) userComuna = db.prepare('SELECT * FROM comunas WHERE id=?').get(s.comuna_id);
  }
  if (comuna_id && !userComuna) userComuna = db.prepare('SELECT * FROM comunas WHERE id=?').get(comuna_id);
  const comunasCache = {};
  for (const w of rows) {
    if (userComuna && w.lat) {
      const c2 = { lat: w.lat, lng: w.lng };
      w.distance_km = distanciaKm(userComuna, c2);
    } else w.distance_km = null;
    w.categories = db.prepare('SELECT c.name, c.icon FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(w.id);
    delete w.user_id;
  }
  res.json({ workers: rows, from_comuna: userComuna ? userComuna.name : null });
});

app.get('/api/workers/:id', (req, res) => {
  const w = db.prepare(`${WORKER_SELECT} WHERE wp.id=?`).get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Trabajador no encontrado' });
  w.categories = db.prepare('SELECT c.* FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(w.id);
  w.comunas = db.prepare(`SELECT c.name, r.name AS region FROM worker_comunas wc JOIN comunas c ON c.id=wc.comuna_id JOIN regions r ON r.id=c.region_id WHERE wc.worker_id=?`).all(w.id);
  w.portfolio = db.prepare('SELECT * FROM portfolio_images WHERE worker_id=? ORDER BY id DESC LIMIT 12').all(w.id);
  w.reviews = db.prepare(`SELECT r.rating,r.quality,r.punctuality,r.treatment,r.price_rating,r.comment,r.created_at,r.is_demo,u.name AS reviewer
    FROM reviews r JOIN users u ON u.id=r.reviewer_id
    WHERE r.direction='cliente_a_trabajador' AND r.reviewee_id=? AND r.reported=0 ORDER BY r.created_at DESC LIMIT 20`).all(w.user_id);
  // NUNCA exponer teléfono/email del trabajador públicamente
  delete w.has_phone;
  res.json({ worker: w });
});

// ============ PERFIL TRABAJADOR (propio) ============
app.put('/api/worker/profile', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  if (!wp) return res.status(404).json({ error: 'Perfil no encontrado' });
  const { oficio, description, years_experience, price_from, status, comuna_id, categories, comunas } = req.body || {};
  db.prepare(`UPDATE worker_profiles SET oficio=?,description=?,years_experience=?,price_from=?,status=?,comuna_id=? WHERE id=?`)
    .run(oficio || wp.oficio, description ?? wp.description, years_experience ?? wp.years_experience, price_from ?? wp.price_from,
      status || wp.status, comuna_id || wp.comuna_id, wp.id);
  if (Array.isArray(categories)) {
    db.prepare('DELETE FROM worker_categories WHERE worker_id=?').run(wp.id);
    for (const c of categories.slice(0, 4)) db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(wp.id, c);
  }
  if (Array.isArray(comunas)) {
    db.prepare('DELETE FROM worker_comunas WHERE worker_id=?').run(wp.id);
    for (const c of comunas.slice(0, 12)) db.prepare('INSERT OR IGNORE INTO worker_comunas(worker_id,comuna_id) VALUES(?,?)').run(wp.id, c);
  }
  res.json({ ok: true });
});
app.post('/api/worker/portfolio', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const { emoji, caption } = req.body || {};
  if (!caption) return res.status(400).json({ error: 'Descripción requerida' });
  const count = db.prepare('SELECT COUNT(*) c FROM portfolio_images WHERE worker_id=?').get(wp.id).c;
  const limit = wp.is_pro ? 12 : 4;
  if (count >= limit) return res.status(400).json({ error: `Límite de ${limit} fotos alcanzado. Con DatoYa PRO puedes subir hasta 12.` });
  db.prepare('INSERT INTO portfolio_images(worker_id,emoji,caption) VALUES(?,?,?)').run(wp.id, emoji || '🛠️', caption);
  res.json({ ok: true });
});
app.post('/api/worker/verification', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const { type } = req.body || {};
  if (!['identidad', 'telefono'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
  if (type === 'telefono') {
    // DEMO: verificación telefónica automática (en producción: SMS con código)
    db.prepare('UPDATE worker_profiles SET verified_phone=1 WHERE id=?').run(wp.id);
    notify(req.user.id, 'verificacion', 'Tu teléfono fue verificado correctamente. (DEMO: en producción se envía un código SMS)', '#/perfil');
    return res.json({ ok: true, demo: true, message: 'Teléfono verificado (modo demo: sin SMS real)' });
  }
  const exists = db.prepare(`SELECT id FROM verification_requests WHERE worker_id=? AND type='identidad' AND status='pendiente'`).get(wp.id);
  if (exists) return res.json({ ok: true, message: 'Ya tienes una solicitud de verificación en revisión' });
  db.prepare(`INSERT INTO verification_requests(worker_id,type) VALUES(?,'identidad')`).run(wp.id);
  res.json({ ok: true, message: 'Solicitud enviada. El equipo DatoYa la revisará pronto.' });
});
app.post('/api/worker/pro', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  db.prepare('UPDATE worker_profiles SET is_pro=1 WHERE id=?').run(wp.id);
  db.prepare(`INSERT INTO subscriptions(worker_id,plan,status) VALUES(?,'PRO','activa')`).run(wp.id);
  notify(req.user.id, 'pro', '¡Ya eres DatoYa PRO! (MODO DEMO: no se realizó ningún cobro real)', '#/perfil');
  res.json({ ok: true, demo: true });
});
app.post('/api/worker/payout', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const disponible = db.prepare(`SELECT COALESCE(SUM(worker_amount),0) s FROM jobs WHERE worker_id=? AND status='FINALIZADO'`).get(wp.id).s;
  const comprometido = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payout_requests WHERE worker_id=? AND status IN ('pendiente','pagado')`).get(wp.id).s;
  const neto = disponible - comprometido;
  if (neto <= 0) return res.status(400).json({ error: 'No tienes saldo disponible para retirar' });
  db.prepare(`INSERT INTO payout_requests(worker_id,amount) VALUES(?,?)`).run(wp.id, neto);
  res.json({ ok: true, demo: true, amount: neto, message: `Solicitud de retiro por ${fmtCLP(neto)} registrada (MODO DEMO: sin transferencia real)` });
});
app.get('/api/worker/earnings', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const total = db.prepare(`SELECT COALESCE(SUM(worker_amount),0) s, COUNT(*) c FROM jobs WHERE worker_id=? AND status='FINALIZADO'`).get(wp.id);
  const comisiones = db.prepare(`SELECT COALESCE(SUM(commission_amount),0) s FROM jobs WHERE worker_id=? AND status='FINALIZADO'`).get(wp.id).s;
  const retiros = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payout_requests WHERE worker_id=? AND status IN ('pendiente','pagado')`).get(wp.id).s;
  const jobs = db.prepare(`SELECT j.id,j.price,j.worker_amount,j.commission_amount,j.status,j.created_at,u.name AS client FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.worker_id=? ORDER BY j.created_at DESC LIMIT 30`).all(wp.id);
  res.json({ total_bruto: total.s, comisiones_datoya: comisiones, neto_recibido: total.s, retiros, disponible: total.s - retiros, jobs, commission_pct: getSetting('commission_pct', '10') });
});

// ============ SOLICITUDES ============
app.post('/api/requests', auth, requireRole('cliente'), (req, res) => {
  const { category_id, title, description, photos, comuna_id, address_detail, urgency, preferred_date, budget } = req.body || {};
  if (!category_id || !title) return res.status(400).json({ error: 'Categoría y título son obligatorios' });
  const id = db.prepare(`INSERT INTO service_requests(client_id,category_id,title,description,photos,comuna_id,address_detail,urgency,preferred_date,budget)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, category_id, title, description || '', JSON.stringify(photos || []), comuna_id || req.user.comuna_id, address_detail || null, urgency || 'lo_antes_posible', preferred_date || null, budget || null).lastInsertRowid;
  // Notificar a trabajadores de la categoría y comuna
  const workers = db.prepare(`SELECT DISTINCT wp.user_id FROM worker_profiles wp
    JOIN worker_categories wc ON wc.worker_id=wp.id
    WHERE wc.category_id=? AND (wp.comuna_id=? OR wp.id IN (SELECT worker_id FROM worker_comunas WHERE comuna_id=?))`).all(category_id, comuna_id || 0, comuna_id || 0);
  for (const w of workers) notify(w.user_id, 'solicitud', `Nueva solicitud: "${title}" en tu zona.`, '#/bandeja');
  res.json({ ok: true, id, notificados: workers.length });
});
app.get('/api/requests/mine', auth, requireRole('cliente'), (req, res) => {
  const rows = db.prepare(`SELECT sr.*, c.name AS category, c.icon, co.name AS comuna,
    (SELECT COUNT(*) FROM quotes q WHERE q.request_id=sr.id AND q.status='pendiente') AS quotes_count
    FROM service_requests sr JOIN categories c ON c.id=sr.category_id LEFT JOIN comunas co ON co.id=sr.comuna_id
    WHERE sr.client_id=? ORDER BY sr.created_at DESC`).all(req.user.id);
  res.json({ requests: rows });
});
// Bandeja del trabajador: solicitudes de su categoría/zona
app.get('/api/requests/feed', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const rows = db.prepare(`SELECT DISTINCT sr.*, c.name AS category, c.icon, co.name AS comuna, u.name AS client_name,
    (SELECT COUNT(*) FROM quotes q WHERE q.request_id=sr.id) AS quotes_count,
    (SELECT q.status FROM quotes q WHERE q.request_id=sr.id AND q.worker_id=?) AS my_quote
    FROM service_requests sr
    JOIN categories c ON c.id=sr.category_id
    LEFT JOIN comunas co ON co.id=sr.comuna_id
    JOIN users u ON u.id=sr.client_id
    JOIN worker_categories wc ON wc.category_id=sr.category_id AND wc.worker_id=?
    JOIN worker_profiles wp ON wp.id=wc.worker_id
    WHERE sr.status='abierta' AND sr.client_id != ?
      AND (sr.comuna_id=wp.comuna_id OR sr.comuna_id IN (SELECT comuna_id FROM worker_comunas WHERE worker_id=?) OR sr.comuna_id IS NULL)
    ORDER BY sr.created_at DESC`).all(wp.id, wp.id, req.user.id, wp.id);
  for (const r of rows) r.client_name = r.client_name.split(' ')[0] + ' ' + (r.client_name.split(' ')[1] || '').charAt(0) + '.'; // privacidad
  res.json({ requests: rows });
});
app.get('/api/requests/:id', auth, (req, res) => {
  const r = db.prepare(`SELECT sr.*, c.name AS category, c.icon, co.name AS comuna, u.name AS client_name, u.id AS client_user_id
    FROM service_requests sr JOIN categories c ON c.id=sr.category_id LEFT JOIN comunas co ON co.id=sr.comuna_id JOIN users u ON u.id=sr.client_id WHERE sr.id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const quotes = db.prepare(`SELECT q.*, wp.rating_avg, wp.rating_count, wp.jobs_completed, wp.verified_identity, wp.is_pro, u.name AS worker_name, wp.id AS worker_profile_id, co.name AS worker_comuna, wp.status AS worker_status
    FROM quotes q JOIN worker_profiles wp ON wp.id=q.worker_id JOIN users u ON u.id=wp.user_id LEFT JOIN comunas co ON co.id=wp.comuna_id
    WHERE q.request_id=? ORDER BY q.created_at`).all(req.params.id);
  const isOwner = r.client_id === req.user.id;
  const isWorker = req.user.role === 'trabajador';
  if (!isOwner && !isWorker && req.user.role !== 'admin') return res.status(403).json({ error: 'Sin acceso' });
  if (!isOwner) { delete r.address_detail; r.client_name = r.client_name.split(' ')[0]; }
  res.json({ request: r, quotes, is_owner: isOwner });
});

// ============ COTIZACIONES ============
app.post('/api/quotes', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  const { request_id, price, description, available_date, duration_estimate, materials_included, comment } = req.body || {};
  if (!request_id || !price) return res.status(400).json({ error: 'Precio es obligatorio' });
  const reqRow = db.prepare('SELECT * FROM service_requests WHERE id=?').get(request_id);
  if (!reqRow || reqRow.status !== 'abierta') return res.status(400).json({ error: 'La solicitud ya no está disponible' });
  const dup = db.prepare('SELECT id FROM quotes WHERE request_id=? AND worker_id=?').get(request_id, wp.id);
  if (dup) return res.status(409).json({ error: 'Ya enviaste una cotización para esta solicitud' });
  db.prepare(`INSERT INTO quotes(request_id,worker_id,price,description,available_date,duration_estimate,materials_included,comment) VALUES(?,?,?,?,?,?,?,?)`)
    .run(request_id, wp.id, price, description || '', available_date || null, duration_estimate || '', materials_included ? 1 : 0, comment || '');
  // Crear conversación automática
  db.prepare('INSERT OR IGNORE INTO conversations(request_id,client_id,worker_id) VALUES(?,?,?)').run(request_id, reqRow.client_id, wp.id);
  notify(reqRow.client_id, 'cotizacion', `Recibiste una cotización de ${fmtCLP(price)} para "${reqRow.title}".`, '#/solicitudes');
  res.json({ ok: true });
});
app.post('/api/quotes/:id/accept', auth, requireRole('cliente'), (req, res) => {
  const q = db.prepare(`SELECT q.*, sr.client_id, sr.title, sr.id AS req_id FROM quotes q JOIN service_requests sr ON sr.id=q.request_id WHERE q.id=?`).get(req.params.id);
  if (!q || q.client_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });
  if (q.status !== 'pendiente') return res.status(400).json({ error: 'Esta cotización ya fue procesada' });
  const pct = parseFloat(getSetting('commission_pct', '10'));
  const commission = Math.round(q.price * pct / 100);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE quotes SET status='aceptada' WHERE id=?`).run(q.id);
    db.prepare(`UPDATE quotes SET status='rechazada' WHERE request_id=? AND id!=? AND status='pendiente'`).run(q.request_id, q.id);
    db.prepare(`UPDATE service_requests SET status='cerrada' WHERE id=?`).run(q.request_id);
    const jobId = db.prepare(`INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount)
      VALUES(?,?,?,?,'TRABAJADOR_SELECCIONADO',?,?,?,?)`).run(q.request_id, q.id, req.user.id, q.worker_id, q.price, pct, commission, q.price - commission).lastInsertRowid;
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(jobId, 'TRABAJADOR_SELECCIONADO', req.user.id);
    db.prepare(`UPDATE conversations SET job_id=? WHERE request_id=? AND worker_id=?`).run(jobId, q.request_id, q.worker_id);
    const wu = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(q.worker_id);
    notify(wu.user_id, 'trabajo', `¡Fuiste elegido para "${q.title}"! Revisa tu panel de trabajos.`, '#/trabajos');
    notify(req.user.id, 'trabajo', `Elegiste una cotización para "${q.title}". Total: ${fmtCLP(q.price)}.`, '#/trabajos');
    return jobId;
  });
  const jobId = tx();
  res.json({ ok: true, job_id: jobId });
});

// ============ TRABAJOS ============
app.get('/api/jobs', auth, (req, res) => {
  let rows;
  if (req.user.role === 'cliente') {
    rows = db.prepare(`SELECT j.*, u.name AS other_name, sr.title FROM jobs j JOIN worker_profiles wp ON wp.id=j.worker_id JOIN users u ON u.id=wp.user_id JOIN service_requests sr ON sr.id=j.request_id WHERE j.client_id=? ORDER BY j.created_at DESC`).all(req.user.id);
  } else if (req.user.role === 'trabajador') {
    const wp = getWorkerByUser(req.user.id);
    rows = db.prepare(`SELECT j.*, u.name AS other_name, sr.title FROM jobs j JOIN users u ON u.id=j.client_id JOIN service_requests sr ON sr.id=j.request_id WHERE j.worker_id=? ORDER BY j.created_at DESC`).all(wp.id);
  } else {
    rows = db.prepare(`SELECT j.*, sr.title FROM jobs j JOIN service_requests sr ON sr.id=j.request_id ORDER BY j.created_at DESC LIMIT 100`).all();
  }
  // Adjuntar si ya fue calificado por este usuario
  for (const j of rows) {
    j.my_review = !!db.prepare('SELECT id FROM reviews WHERE job_id=? AND reviewer_id=?').get(j.id, req.user.id);
  }
  res.json({ jobs: rows });
});
app.post('/api/jobs/:id/status', auth, (req, res) => {
  const { status } = req.body || {};
  const valid = ['CONFIRMADO', 'EN_PROCESO', 'FINALIZADO', 'CANCELADO', 'DISPUTA'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isWorker = wp.user_id === req.user.id;
  if (!isClient && !isWorker && req.user.role !== 'admin') return res.status(403).json({ error: 'Sin acceso' });
  if (status === 'FINALIZADO' && !isClient && req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el cliente puede marcar el trabajo como terminado' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE jobs SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id, status, req.user.id);
    if (status === 'FINALIZADO') {
      db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
      // Pago DEMO automático
      db.prepare(`INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_completado')`)
        .run(job.id, job.price, job.commission_amount, job.worker_amount);
      db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id, job.commission_pct, job.commission_amount);
      notify(job.client_id, 'pago', `Trabajo finalizado. Pago registrado en MODO DEMO: ${fmtCLP(job.price)}. Recuerda calificar.`, '#/trabajos');
      notify(wp.user_id, 'pago', `Trabajo finalizado. Recibirás ${fmtCLP(job.worker_amount)} (comisión DatoYa ${fmtCLP(job.commission_amount)}). MODO DEMO.`, '#/trabajos');
    } else {
      const target = isClient ? wp.user_id : job.client_id;
      notify(target, 'trabajo', `El trabajo cambió a estado: ${status.replace(/_/g, ' ')}.`, '#/trabajos');
    }
  });
  tx();
  res.json({ ok: true });
});

// ============ CHAT ============
app.get('/api/conversations', auth, (req, res) => {
  let rows;
  if (req.user.role === 'trabajador') {
    const wp = getWorkerByUser(req.user.id);
    rows = db.prepare(`SELECT cv.*, u.name AS other_name, sr.title,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=cv.id AND m.sender_id!=? AND m.read_at IS NULL) AS unread,
      (SELECT m.body FROM messages m WHERE m.conversation_id=cv.id ORDER BY m.id DESC LIMIT 1) AS last_msg,
      (SELECT m.created_at FROM messages m WHERE m.conversation_id=cv.id ORDER BY m.id DESC LIMIT 1) AS last_at
      FROM conversations cv JOIN users u ON u.id=cv.client_id LEFT JOIN service_requests sr ON sr.id=cv.request_id
      WHERE cv.worker_id=? ORDER BY last_at DESC`).all(req.user.id, wp.id);
  } else {
    rows = db.prepare(`SELECT cv.*, u.name AS other_name, sr.title,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=cv.id AND m.sender_id!=? AND m.read_at IS NULL) AS unread,
      (SELECT m.body FROM messages m WHERE m.conversation_id=cv.id ORDER BY m.id DESC LIMIT 1) AS last_msg,
      (SELECT m.created_at FROM messages m WHERE m.conversation_id=cv.id ORDER BY m.id DESC LIMIT 1) AS last_at
      FROM conversations cv JOIN worker_profiles wp ON wp.id=cv.worker_id JOIN users u ON u.id=wp.user_id LEFT JOIN service_requests sr ON sr.id=cv.request_id
      WHERE cv.client_id=? ORDER BY last_at DESC`).all(req.user.id, req.user.id);
  }
  res.json({ conversations: rows });
});
app.get('/api/conversations/:id/messages', auth, (req, res) => {
  const cv = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if (!cv) return res.status(404).json({ error: 'No encontrada' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(cv.worker_id);
  if (cv.client_id !== req.user.id && wp.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Sin acceso' });
  const msgs = db.prepare('SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.id').all(cv.id);
  db.prepare(`UPDATE messages SET read_at=datetime('now') WHERE conversation_id=? AND sender_id!=? AND read_at IS NULL`).run(cv.id, req.user.id);
  res.json({ messages: msgs, locked: !cv.job_id, me: req.user.id });
});
app.post('/api/conversations/:id/messages', auth, (req, res) => {
  const cv = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if (!cv) return res.status(404).json({ error: 'No encontrada' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(cv.worker_id);
  if (cv.client_id !== req.user.id && wp.user_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });
  let { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
  let blocked = false;
  if (!cv.job_id) {
    // Antes de aceptar el trabajo: filtrar datos de contacto (anti-estafa)
    const f = filtrarContacto(body);
    body = f.limpio; blocked = f.bloqueado;
  }
  db.prepare('INSERT INTO messages(conversation_id,sender_id,body,blocked) VALUES(?,?,?,?)').run(cv.id, req.user.id, body, blocked ? 1 : 0);
  const target = cv.client_id === req.user.id ? wp.user_id : cv.client_id;
  notify(target, 'mensaje', `Tienes un nuevo mensaje de ${req.user.name.split(' ')[0]}.`, '#/mensajes');
  res.json({ ok: true, blocked, warning: blocked ? 'Por seguridad, no puedes compartir datos de contacto antes de aceptar un trabajo.' : null });
});
// Iniciar conversación desde un perfil
app.post('/api/conversations/start', auth, requireRole('cliente'), (req, res) => {
  const { worker_id } = req.body || {};
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(worker_id);
  if (!wp) return res.status(404).json({ error: 'Trabajador no encontrado' });
  const existing = db.prepare('SELECT id FROM conversations WHERE client_id=? AND worker_id=? AND request_id IS NULL').get(req.user.id, worker_id);
  if (existing) return res.json({ ok: true, id: existing.id });
  const id = db.prepare('INSERT INTO conversations(client_id,worker_id) VALUES(?,?)').run(req.user.id, worker_id).lastInsertRowid;
  res.json({ ok: true, id });
});

// ============ RESEÑAS ============
app.post('/api/jobs/:id/review', auth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job || job.status !== 'FINALIZADO') return res.status(400).json({ error: 'Solo puedes calificar trabajos finalizados' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isWorker = wp.user_id === req.user.id;
  if (!isClient && !isWorker) return res.status(403).json({ error: 'Sin acceso' });
  const { rating, quality, punctuality, treatment, price_rating, comment } = req.body || {};
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Calificación de 1 a 5 estrellas requerida' });
  const direction = isClient ? 'cliente_a_trabajador' : 'trabajador_a_cliente';
  const reviewee = isClient ? wp.user_id : job.client_id;
  try {
    db.prepare(`INSERT INTO reviews(job_id,reviewer_id,reviewee_id,direction,rating,quality,punctuality,treatment,price_rating,comment) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(job.id, req.user.id, reviewee, direction, rating, quality || rating, punctuality || rating, treatment || rating, price_rating || rating, comment || '');
  } catch { return res.status(409).json({ error: 'Ya calificaste este trabajo' }); }
  if (isClient) {
    // Recalcular promedio del trabajador
    const agg = db.prepare(`SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE reviewee_id=? AND direction='cliente_a_trabajador' AND reported=0`).get(wp.user_id);
    db.prepare('UPDATE worker_profiles SET rating_avg=?, rating_count=? WHERE id=?').run(Math.round(agg.a * 10) / 10, agg.c, wp.id);
    notify(wp.user_id, 'resena', `Recibiste una nueva reseña de ${rating} estrellas.`, '#/perfil');
  }
  res.json({ ok: true });
});

// ============ FAVORITOS ============
app.post('/api/favorites/:workerId', auth, requireRole('cliente'), (req, res) => {
  try {
    db.prepare('INSERT INTO favorites(client_id,worker_id) VALUES(?,?)').run(req.user.id, req.params.workerId);
    res.json({ ok: true, favorite: true });
  } catch {
    db.prepare('DELETE FROM favorites WHERE client_id=? AND worker_id=?').run(req.user.id, req.params.workerId);
    res.json({ ok: true, favorite: false });
  }
});
app.get('/api/favorites', auth, requireRole('cliente'), (req, res) => {
  res.json({ favorites: db.prepare('SELECT worker_id FROM favorites WHERE client_id=?').all(req.user.id).map(r => r.worker_id) });
});

// ============ NOTIFICACIONES ============
app.get('/api/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40').all(req.user.id);
  res.json({ notifications: rows });
});
app.post('/api/notifications/read', auth, (req, res) => {
  db.prepare(`UPDATE notifications SET read_at=datetime('now') WHERE user_id=? AND read_at IS NULL`).run(req.user.id);
  res.json({ ok: true });
});

// ============ DENUNCIAS ============
app.post('/api/reports', auth, (req, res) => {
  const { target_type, target_id, reason, details } = req.body || {};
  const razones = ['estafa', 'incumplimiento', 'mal_comportamiento', 'trabajo_defectuoso', 'pago_no_realizado', 'perfil_falso'];
  if (!razones.includes(reason)) return res.status(400).json({ error: 'Motivo inválido' });
  db.prepare('INSERT INTO reports(reporter_id,target_type,target_id,reason,details) VALUES(?,?,?,?,?)').run(req.user.id, target_type, target_id, reason, details || '');
  res.json({ ok: true, message: 'Denuncia recibida. El equipo DatoYa la revisará.' });
});

// ============ VERIFICACIÓN TELÉFONO DEMO ============
app.post('/api/auth/verify-phone', auth, (req, res) => {
  const { code } = req.body || {};
  // DEMO: cualquier código de 4 dígitos funciona. En producción: SMS real.
  if (!/^\d{4}$/.test(code || '')) return res.status(400).json({ error: 'Ingresa el código de 4 dígitos (DEMO: usa cualquier 4 dígitos, ej. 1234)' });
  if (req.user.role === 'trabajador') {
    const wp = getWorkerByUser(req.user.id);
    db.prepare('UPDATE worker_profiles SET verified_phone=1 WHERE id=?').run(wp.id);
  }
  res.json({ ok: true, demo: true });
});

// ============ ADMIN ============
app.get('/api/admin/stats', auth, requireRole('admin'), (req, res) => {
  const s = {};
  s.users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  s.workers = db.prepare('SELECT COUNT(*) c FROM worker_profiles').get().c;
  s.requests = db.prepare('SELECT COUNT(*) c FROM service_requests').get().c;
  s.jobs_completed = db.prepare(`SELECT COUNT(*) c FROM jobs WHERE status='FINALIZADO'`).get().c;
  s.jobs_active = db.prepare(`SELECT COUNT(*) c FROM jobs WHERE status NOT IN ('FINALIZADO','CANCELADO')`).get().c;
  s.gmv = db.prepare(`SELECT COALESCE(SUM(price),0) s FROM jobs WHERE status='FINALIZADO'`).get().s;
  s.commissions = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM commissions').get().s;
  s.avg_rating = Math.round((db.prepare('SELECT AVG(rating) a FROM reviews').get().a || 0) * 10) / 10;
  s.pending_reports = db.prepare(`SELECT COUNT(*) c FROM reports WHERE status='pendiente'`).get().c;
  s.pending_verifications = db.prepare(`SELECT COUNT(*) c FROM verification_requests WHERE status='pendiente'`).get().c;
  s.new_users_week = db.prepare(`SELECT COUNT(*) c FROM users WHERE created_at > datetime('now','-7 days')`).get().c;
  s.jobs_by_status = db.prepare('SELECT status, COUNT(*) c FROM jobs GROUP BY status').all();
  s.jobs_by_month = db.prepare(`SELECT substr(created_at,1,7) m, COUNT(*) c, SUM(price) v FROM jobs WHERE status='FINALIZADO' GROUP BY m ORDER BY m`).all();
  s.top_categories = db.prepare(`SELECT c.name, c.icon, COUNT(*) n FROM service_requests sr JOIN categories c ON c.id=sr.category_id GROUP BY c.id ORDER BY n DESC LIMIT 5`).all();
  res.json({ stats: s });
});
app.get('/api/admin/users', auth, requireRole('admin'), (req, res) => {
  res.json({ users: db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role,u.is_active,u.is_demo,u.created_at,c.name AS comuna FROM users u LEFT JOIN comunas c ON c.id=u.comuna_id ORDER BY u.created_at DESC`).all() });
});
app.post('/api/admin/users/:id/toggle', auth, requireRole('admin'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u || u.role === 'admin') return res.status(400).json({ error: 'No se puede modificar este usuario' });
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(u.is_active ? 0 : 1, u.id);
  res.json({ ok: true, active: !u.is_active });
});
app.get('/api/admin/reports', auth, requireRole('admin'), (req, res) => {
  res.json({ reports: db.prepare(`SELECT r.*, u.name AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC`).all() });
});
app.post('/api/admin/reports/:id/resolve', auth, requireRole('admin'), (req, res) => {
  const { status } = req.body || {};
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status === 'descartada' ? 'descartada' : 'resuelta', req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/verifications', auth, requireRole('admin'), (req, res) => {
  res.json({ verifications: db.prepare(`SELECT v.*, u.name, wp.oficio FROM verification_requests v JOIN worker_profiles wp ON wp.id=v.worker_id JOIN users u ON u.id=wp.user_id ORDER BY v.created_at DESC`).all() });
});
app.post('/api/admin/verifications/:id', auth, requireRole('admin'), (req, res) => {
  const { action } = req.body || {};
  const v = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'No encontrada' });
  const aprobar = action === 'aprobar';
  db.prepare('UPDATE verification_requests SET status=? WHERE id=?').run(aprobar ? 'aprobada' : 'rechazada', v.id);
  if (aprobar && v.type === 'identidad') db.prepare('UPDATE worker_profiles SET verified_identity=1 WHERE id=?').run(v.worker_id);
  const wu = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(v.worker_id);
  notify(wu.user_id, 'verificacion', aprobar ? '¡Tu identidad fue verificada! ✓' : 'Tu solicitud de verificación fue rechazada.', '#/perfil');
  res.json({ ok: true });
});
app.get('/api/admin/settings', auth, requireRole('admin'), (req, res) => {
  res.json({ settings: { commission_pct: getSetting('commission_pct', '10'), pro_price: getSetting('pro_price', '9990'), featured_price: getSetting('featured_price', '4990') } });
});
app.post('/api/admin/settings', auth, requireRole('admin'), (req, res) => {
  const { commission_pct, pro_price, featured_price } = req.body || {};
  if (commission_pct !== undefined) {
    const p = parseFloat(commission_pct);
    if (isNaN(p) || p < 0 || p > 50) return res.status(400).json({ error: 'Comisión debe estar entre 0 y 50%' });
    setSetting('commission_pct', p);
  }
  if (pro_price !== undefined) setSetting('pro_price', parseInt(pro_price) || 9990);
  if (featured_price !== undefined) setSetting('featured_price', parseInt(featured_price) || 4990);
  res.json({ ok: true });
});
app.get('/api/admin/workers', auth, requireRole('admin'), (req, res) => {
  res.json({ workers: db.prepare(`${WORKER_SELECT} ORDER BY wp.created_at DESC`).all() });
});
app.post('/api/admin/workers/:id/feature', auth, requireRole('admin'), (req, res) => {
  const w = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(req.params.id);
  db.prepare('UPDATE worker_profiles SET is_featured=? WHERE id=?').run(w.is_featured ? 0 : 1, w.id);
  res.json({ ok: true, featured: !w.is_featured });
});
app.post('/api/admin/categories', auth, requireRole('admin'), (req, res) => {
  const { name, icon } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  db.prepare('INSERT INTO categories(name,icon) VALUES(?,?)').run(name, icon || '🧰');
  res.json({ ok: true });
});
app.post('/api/admin/categories/:id/toggle', auth, requireRole('admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  db.prepare('UPDATE categories SET active=? WHERE id=?').run(c.active ? 0 : 1, c.id);
  res.json({ ok: true });
});
app.get('/api/admin/payouts', auth, requireRole('admin'), (req, res) => {
  res.json({ payouts: db.prepare(`SELECT p.*, u.name FROM payout_requests p JOIN worker_profiles wp ON wp.id=p.worker_id JOIN users u ON u.id=wp.user_id ORDER BY p.created_at DESC`).all() });
});
app.post('/api/admin/payouts/:id', auth, requireRole('admin'), (req, res) => {
  const { action } = req.body || {};
  db.prepare('UPDATE payout_requests SET status=? WHERE id=?').run(action === 'pagar' ? 'pagado' : 'rechazado', req.params.id);
  res.json({ ok: true, demo: true });
});

// ============ MISC ============
app.get('/api/config', (req, res) => {
  res.json({
    commission_pct: getSetting('commission_pct', '10'),
    pro_price: getSetting('pro_price', '9990'),
    demo_mode: true,
    demo_accounts: [
      { role: 'Cliente', email: 'cliente@demo.cl' },
      { role: 'Trabajador', email: 'trabajador@demo.cl' },
      { role: 'Administrador', email: 'admin@demo.cl' }
    ]
  });
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:${PORT}`));

// DatoYa — Servidor backend (API REST + frontend estático)
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const { db, hashPassword, verifyPassword, getSetting, setSetting, notify, seed } = require('./db');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Servir el logo directamente desde la raíz del proyecto para evitar problemas
// si Render aún no ha generado/actualizado la carpeta public/.
app.get('/datoya-logo.svg', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(__dirname, 'datoya-logo.svg'));
});

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
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.max(0, 1 - a)) * 10) / 10;
}
// Filtro anti-fraude: bloquea intercambio de datos de contacto antes de aceptar trabajo
function filtrarContacto(texto) {
  const patrones = [
    /(\+?56\s?)?9\s?\d{4}\s?\d{4}/g,
    /\b\d{8,9}\b/g,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /(instagram|whatsapp|wsp|face(book)?|telegram|@)[\s.:]*[a-z0-9_.-]+/gi,
    /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g
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
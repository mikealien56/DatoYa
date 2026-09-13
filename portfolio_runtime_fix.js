// DatoYa 2.0 - soporte de fotos reales en portafolio
const express = require('express');
const { db } = require('./db');
// Asegura la tabla incluso cuando Render inicia una BD completamente nueva.
db.exec("CREATE TABLE IF NOT EXISTS portfolio_images (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE, emoji TEXT NOT NULL DEFAULT '🛠️', caption TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
try { db.exec('ALTER TABLE portfolio_images ADD COLUMN data TEXT'); } catch (_) {}
const originalPost = express.application.post;
express.application.post = function(route, ...handlers) {
  if (route === '/api/worker/portfolio') {
    const handler = (req, res) => {
      const token = req.cookies && req.cookies.datoya_token;
      if (!token) return res.status(401).json({error:'No autenticado'});
      const u = db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at > datetime('now')").get(token);
      if (!u) return res.status(401).json({error:'Sesión expirada'});
      if (!u.is_active) return res.status(403).json({error:'Cuenta suspendida'});
      if (u.role !== 'trabajador') return res.status(403).json({error:'No tienes permiso para esta acción'});
      const wp = db.prepare('SELECT * FROM worker_profiles WHERE user_id=?').get(u.id);
      if (!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
      const {data, caption, emoji} = req.body || {};
      if (!caption || !String(caption).trim()) return res.status(400).json({error:'Descripción requerida'});
      if (!data || typeof data !== 'string') return res.status(400).json({error:'Debes seleccionar una foto'});
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({error:'Formato de imagen no compatible'});
      if (data.length > 1650000) return res.status(400).json({error:'La foto es demasiado grande. Usa una imagen menor a 1,2 MB.'});
      const count = db.prepare('SELECT COUNT(*) c FROM portfolio_images WHERE worker_id=?').get(wp.id).c;
      const limit = wp.is_pro ? 12 : 4;
      if (count >= limit) return res.status(400).json({error:`Límite de ${limit} fotos alcanzado. Con DatoYa PRO puedes subir hasta 12.`});
      db.prepare('INSERT INTO portfolio_images(worker_id,emoji,caption,data) VALUES(?,?,?,?)').run(wp.id, emoji || '🛠️', String(caption).trim(), data);
      res.json({ok:true});
    };
    return originalPost.call(this, route, handler);
  }
  return originalPost.call(this, route, ...handlers);
};

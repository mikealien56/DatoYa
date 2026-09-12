// DatoYa 2.0 — solicitudes dirigidas a un profesional
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');
const marker = '// DATOYA_TARGET_WORKER_PATCH_V1';
if (!source.includes(marker)) {
  const oldDestructure = "const { category_id, title, description, photos, comuna_id, address_detail, urgency, preferred_date, budget } = req.body || {};";
  const newDestructure = oldDestructure + `\n  // DATOYA_TARGET_WORKER_PATCH_V1\n  const targetWorkerId = Number(req.body && req.body.worker_id) || null;\n  if (targetWorkerId) {\n    const target = db.prepare('SELECT wp.id, wp.user_id FROM worker_profiles wp WHERE wp.id=?').get(targetWorkerId);\n    if (!target) return res.status(404).json({ error: 'Profesional no encontrado' });\n    const supportsCategory = db.prepare('SELECT 1 FROM worker_categories WHERE worker_id=? AND category_id=?').get(targetWorkerId, category_id);\n    if (!supportsCategory) return res.status(400).json({ error: 'Este profesional no ofrece la categoría seleccionada' });\n  }`;
  if (!source.includes(oldDestructure)) throw new Error('No se encontró el inicio de /api/requests');
  source = source.replace(oldDestructure, newDestructure);
  const notifyMarker = "  // Notificar a trabajadores de la categoría y comuna\n";
  const notifyReplacement = `  // Si la solicitud fue dirigida a un profesional, dejamos la conversación asociada desde el inicio.\n  if (targetWorkerId) {\n    db.prepare('INSERT OR IGNORE INTO conversations(request_id,client_id,worker_id) VALUES(?,?,?)').run(id, req.user.id, targetWorkerId);\n  }\n  // Notificar a trabajadores de la categoría y comuna\n`;
  if (!source.includes(notifyMarker)) throw new Error('No se encontró el bloque de notificaciones');
  source = source.replace(notifyMarker, notifyReplacement);
  const workersQuery = "WHERE wc.category_id=? AND (wp.comuna_id=? OR wp.id IN (SELECT worker_id FROM worker_comunas WHERE comuna_id=?))`).all(category_id, comuna_id || 0, comuna_id || 0);";
  const workersReplacement = "WHERE wc.category_id=? AND (wp.comuna_id=? OR wp.id IN (SELECT worker_id FROM worker_comunas WHERE comuna_id=?)) AND (? IS NULL OR wp.id=?)`).all(category_id, comuna_id || 0, comuna_id || 0, targetWorkerId, targetWorkerId);";
  if (!source.includes(workersQuery)) throw new Error('No se encontró la consulta de trabajadores');
  source = source.replace(workersQuery, workersReplacement);
  fs.writeFileSync(serverPath, source);
}

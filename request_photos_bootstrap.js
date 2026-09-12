// DatoYa — fotos del problema al publicar una solicitud (DEMO)
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const serverFile = path.join(ROOT, 'server.js');
const originalReadFileSync = fs.readFileSync;

const injection = `
// ============ FOTOS DE SOLICITUD DATOYA ============
function requestPhotoAccess(row, user) {
  if (!row || !user) return false;
  if (user.role === 'admin') return true;
  if (row.client_id === user.id) return true;
  if (user.role !== 'trabajador') return false;
  const wp = getWorkerByUser(user.id);
  if (!wp) return false;
  const assigned = db.prepare('SELECT 1 FROM jobs WHERE request_id=? AND worker_id=? LIMIT 1').get(row.id, wp.id);
  if (assigned) return true;
  const categoryOk = !!db.prepare('SELECT 1 FROM worker_categories WHERE worker_id=? AND category_id=(SELECT category_id FROM service_requests WHERE id=?) LIMIT 1').get(wp.id, row.id);
  if (!categoryOk) return false;
  if (!row.comuna_id) return true;
  if (wp.comuna_id === row.comuna_id) return true;
  return !!db.prepare('SELECT 1 FROM worker_comunas WHERE worker_id=? AND comuna_id=? LIMIT 1').get(wp.id, row.comuna_id);
}
function readRequestPhotos(row) {
  try {
    const photos = JSON.parse(row.photos || '[]');
    return Array.isArray(photos) ? photos : [];
  } catch (_) { return []; }
}
app.get('/api/requests/:id/photos', auth, (req, res) => {
  const row = db.prepare('SELECT id,client_id,category_id,comuna_id,photos FROM service_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (!requestPhotoAccess(row, req.user)) return res.status(403).json({ error: 'Sin acceso a las fotos de esta solicitud' });
  res.json({ photos: readRequestPhotos(row), demo: true });
});
app.post('/api/requests/:id/photos', auth, requireRole('cliente'), (req, res) => {
  const row = db.prepare('SELECT id,client_id,photos,status FROM service_requests WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (row.client_id !== req.user.id) return res.status(403).json({ error: 'Solo el cliente dueño puede subir fotos' });
  const incoming = Array.isArray(req.body?.photos) ? req.body.photos : [];
  if (incoming.length > 5) return res.status(400).json({ error: 'Puedes subir máximo 5 fotos' });
  let cleaned = [];
  try { cleaned = incoming.map(cleanRequestPhotoInput); } catch (e) { return res.status(400).json({ error: e.message }); }
  const total = cleaned.reduce((sum, p) => sum + p.size_bytes, 0);
  if (total > 1400 * 1024) return res.status(413).json({ error: 'El total de las fotos no puede superar 1,4 MB' });
  db.prepare('UPDATE service_requests SET photos=? WHERE id=?').run(JSON.stringify(cleaned), row.id);
  res.status(201).json({ ok: true, photos: cleaned, demo: true });
});
// ================================================
`;

function cleanRequestPhotoInput(item) {
  const mime = String(item?.mime_type || item?.mime || '');
  const name = String(item?.original_name || item?.name || 'foto').slice(0, 160);
  const data = String(item?.data || '');
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(mime)) throw new Error('Solo se permiten imágenes JPG, PNG o WebP');
  const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match || match[1] !== mime) throw new Error('Imagen inválida');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 320 * 1024) throw new Error('Cada foto debe pesar como máximo 320 KB');
  return { data, mime_type: mime, original_name: name, size_bytes: buffer.length };
}

const original = fs.readFileSync(serverFile, 'utf8');
const marker = "// ============ ADMIN ============";
if (!original.includes(marker)) throw new Error('No se encontró el punto de inyección de fotos de solicitud');
const patched = original.includes('// ============ FOTOS DE SOLICITUD DATOYA ============')
  ? original
  : original.replace(marker, injection + '\n' + marker);

fs.readFileSync = function(file, enc) {
  if (path.resolve(String(file)) === path.resolve(serverFile)) {
    return enc ? patched : Buffer.from(patched);
  }
  return originalReadFileSync.apply(fs, arguments);
};
try { require('./admin_v2_bootstrap'); }
finally { fs.readFileSync = originalReadFileSync; }

// DatoYa 2.0 — estado de reseña del trabajo para la UI.
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

function injectReviewStatus(source) {
  if (source.includes('DATOYA REVIEW STATUS V1')) return source;
  const marker = '// ============ FAVORITOS ============';
  if (!source.includes(marker)) throw new Error('No se encontró marcador para estado de reseña');
  const block = `
// ============ DATOYA REVIEW STATUS V1 ============
app.get('/api/jobs/:id/review-status', auth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isWorker = !!wp && wp.user_id === req.user.id;
  if (!isClient && !isWorker && req.user.role !== 'admin') return res.status(403).json({ error:'Sin acceso' });
  if (job.status !== 'FINALIZADO') return res.json({ reviewed:false, eligible:false, status:job.status });
  const direction = isClient ? 'cliente_a_trabajador' : isWorker ? 'trabajador_a_cliente' : null;
  if (!direction) return res.json({ reviewed:false, eligible:false, status:job.status });
  const review = db.prepare('SELECT id,rating,comment,created_at FROM reviews WHERE job_id=? AND reviewer_id=? AND direction=?').get(job.id, req.user.id, direction);
  res.json({ reviewed:!!review, eligible:true, direction, review:review || null });
});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === path.resolve(serverFile) && typeof value === 'string') return injectReviewStatus(value);
  return value;
};

module.exports = { injectReviewStatus };

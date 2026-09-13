// DatoYa 2.0 — guard previo del flujo de Pago Protegido DEMO.
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) !== path.resolve(serverFile) || typeof value !== 'string') return value;
  if (value.includes('DAT0YA_PROTECTION_CONFIRM_GUARD')) return value;
  const marker = '// ============ AUTH ============';
  const guard = `
// DAT0YA_PROTECTION_CONFIRM_GUARD
// El cliente solo puede confirmar cuando el profesional declaró terminado.
app.use('/api/jobs/:id/status', auth, (req, res, next) => {
  const requested = String((req.body || {}).status || '');
  if (requested !== 'FINALIZADO') return next();
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  const isClient = job.client_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isClient && !isAdmin) return next();
  if (isAdmin) return next();
  const protection = db.prepare('SELECT status FROM payment_protections WHERE job_id=?').get(job.id);
  if (!protection || protection.status !== 'AWAITING_CONFIRMATION') {
    return res.status(409).json({ error:'El trabajador aún no ha declarado terminado el trabajo. Revisa las evidencias cuando estén disponibles.' });
  }
  return next();
});

`;
  if (!value.includes(marker)) throw new Error('No se encontró AUTH para guard de confirmación');
  return value.replace(marker, guard + marker);
};

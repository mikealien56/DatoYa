// DatoYa 2.0 — protege la máquina de estados del trabajo antes de las rutas legacy.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

function injectWorkflowGuard(source) {
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección del guard de trabajos');
  if (source.includes('DATOYA_WORKFLOW_GUARD_V1')) return source;
  const block = "\n// ============ DATOYA WORKFLOW GUARD V1 ============\n" +
    "// Las rutas legacy siguen gestionando persistencia/notificaciones, pero este middleware\n" +
    "// impide saltos de estado imposibles o acciones realizadas por el rol incorrecto.\n" +
    "app.use('/api/jobs/:id/status', auth, (req, res, next) => {\n" +
    "  const requested = String((req.body || {}).status || '');\n" +
    "  if (!['CONFIRMADO','EN_PROCESO','CANCELADO'].includes(requested)) return next();\n" +
    "  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);\n" +
    "  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });\n" +
    "  const wp = db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);\n" +
    "  const isClient = job.client_id === req.user.id;\n" +
    "  const isWorker = !!wp && wp.user_id === req.user.id;\n" +
    "  const isAdmin = req.user.role === 'admin';\n" +
    "  if (!isClient && !isWorker && !isAdmin) return res.status(403).json({ error:'Sin acceso' });\n" +
    "  const transitions = {\n" +
    "    CONFIRMADO: ['TRABAJADOR_SELECCIONADO'],\n" +
    "    EN_PROCESO: ['CONFIRMADO'],\n" +
    "    CANCELADO: ['TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO']\n" +
    "  };\n" +
    "  if (!transitions[requested].includes(job.status) && !isAdmin) {\n" +
    "    return res.status(409).json({ error:'No se puede cambiar de ' + job.status + ' a ' + requested });\n" +
    "  }\n" +
    "  if (requested === 'CONFIRMADO' || requested === 'EN_PROCESO') {\n" +
    "    if (!isWorker && !isAdmin) return res.status(403).json({ error:'Solo el profesional puede avanzar esta etapa' });\n" +
    "  }\n" +
    "  next();\n" +
"});\n";
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === path.resolve(serverPath) && typeof value === 'string') return injectWorkflowGuard(value);
  return value;
};

module.exports = { injectWorkflowGuard };

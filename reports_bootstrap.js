// DatoYa 2.0 — composición de rutas administrativas y flujo de solicitudes
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const routesPath = path.join(__dirname, 'reports_routes.js');
const { applyRequestPhotosPatch } = require('./request_photos_bootstrap');
const { injectEvidence } = require('./evidence_bootstrap');

const originalReadFileSync = fs.readFileSync;
const original = originalReadFileSync(serverPath, 'utf8');
const marker = '// ============ DENUNCIAS ============';
const injection = fs.readFileSync(routesPath, 'utf8');
if (!original.includes(marker)) throw new Error('No se encontró el punto de inyección de denuncias');

let patched = original.includes('// ============ EXPEDIENTE DE DENUNCIAS DATOYA ============')
  ? original
  : original.replace(marker, injection + '\n' + marker);

patched = applyRequestPhotosPatch(patched);
patched = injectEvidence(patched);

// El parche debe quedar escrito antes de cargar cualquier bootstrap posterior.
fs.writeFileSync(serverPath, patched);

// admin_v2_bootstrap volverá a leer el server.js ya compuesto y cargará sus rutas.
require('./admin_v2_bootstrap');

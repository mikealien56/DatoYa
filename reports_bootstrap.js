// DatoYa 2.0 — Expediente de denuncias para administración
// Parche runtime: evita tocar server.js y agrega contexto completo al panel admin.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const routesPath = path.join(__dirname, 'reports_routes.js');
const marker = '// ============ DENUNCIAS ============';
const original = fs.readFileSync(serverPath, 'utf8');
const injection = fs.readFileSync(routesPath, 'utf8');
if (!original.includes(marker)) throw new Error('No se encontró el punto de inyección de denuncias');
const patched = original.includes('// ============ EXPEDIENTE DE DENUNCIAS DATOYA ============') ? original : original.replace(marker, injection + '\n' + marker);
fs.writeFileSync(serverPath, patched);
require('./admin_v2_bootstrap');

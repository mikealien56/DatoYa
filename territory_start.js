// Ejecuta primero el esquema base y luego las migraciones de DatoYa.
// El orden es importante: el esquema avanzado crea tablas que el backend necesita.
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'protection_ui.js', 'gps_ui.js', 'workflow_v2_ui.js', 'gps_map_ui.js']) {
  const source = path.join(__dirname, file);
  const target = path.join(publicDir, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
}

require('./db');
require('./hardening_schema');
require('./protection_schema');
require('./evidence_schema');
require('./gps_schema');
require('./dispute_schema');
require('./territory_bootstrap');
require('./evidence_runtime');
require('./gps_bootstrap');
require('./dispute_bootstrap');

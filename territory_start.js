// Ejecuta primero el esquema base y luego las migraciones territoriales y de seguridad.
// El bootstrap territorial necesita que la tabla comunas ya exista.
// También prepara public/ para que el servidor pueda atender el fallback SPA
// cuando se ejecuta directamente en CI/local (Render lo prepara en el build).
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css']) {
  const source = path.join(__dirname, file);
  const target = path.join(publicDir, file);
  if (fs.existsSync(source) && !fs.existsSync(target)) {
    fs.copyFileSync(source, target);
  }
}

require('./db');
require('./hardening_schema');
require('./territory_bootstrap');
require('./demo_bootstrap');

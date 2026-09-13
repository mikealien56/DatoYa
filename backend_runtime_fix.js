// DatoYa 2.0 — hardening mínimo del servidor para despliegue detrás de proxy (Render).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server.js');

if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8');

  if (!src.includes("app.set('trust proxy', 1);")) {
    src = src.replace("const app = express();", "const app = express();\napp.set('trust proxy', 1);");
  }

  src = src.replace(
    /sameSite: 'lax' \}\);/g,
    "sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });"
  );

  // El frontend debe distinguir cuentas DEMO de profesionales reales sin
  // exponer correo, teléfono ni ningún otro dato privado del trabajador.
  src = src.replace(
    'SELECT wp.*, u.name, u.phone IS NOT NULL AS has_phone, c.name AS comuna, c.lat, c.lng, r.name AS region',
    'SELECT wp.*, u.name, u.is_demo, u.phone IS NOT NULL AS has_phone, c.name AS comuna, c.lat, c.lng, r.name AS region'
  );

  fs.writeFileSync(file, src);
}

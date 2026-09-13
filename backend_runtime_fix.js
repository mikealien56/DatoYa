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

  fs.writeFileSync(file, src);
}

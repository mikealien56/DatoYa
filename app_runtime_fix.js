// Reparaciones de emergencia del frontend antes de copiarlo a public/.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app.js');
if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8');
  // renderJobs tenía un backtick sobrante al cerrar el fallback de la lista.
  src = src.replace("Aún no tienes trabajos.</div>`;}", "Aún no tienes trabajos.</div>';}");
  fs.writeFileSync(file, src);
}

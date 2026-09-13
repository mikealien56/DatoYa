// Corrige la etiqueta DEMO fija de las tarjetas de profesionales.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app.js');

if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/demoTag\(1\)/g, 'demoTag(w.is_demo)');
  fs.writeFileSync(file, src);
}

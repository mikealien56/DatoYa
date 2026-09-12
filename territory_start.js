// DatoYa territory bootstrap / static server
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const publicDir = path.join(ROOT, 'public');
fs.mkdirSync(publicDir, { recursive: true });

for (const file of ['index.html', 'datoya-logo.svg', 'app.js', 'styles.css', 'protection_ui.js', 'gps_ui.js', 'workflow_v2_ui.js', 'gps_map_ui.js']) {
  const source = path.join(ROOT, file);
  const target = path.join(publicDir, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
}

// server.js es el proceso HTTP principal y se encarga de app.listen().
require('./server');

// DatoYa territory bootstrap / static server
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const publicDir = path.join(ROOT, 'public');
fs.mkdirSync(publicDir, { recursive: true });

for (const file of ['index.html', 'datoya-logo.svg', 'app.js', 'styles.css', 'role_ui_fix.js', 'protection_ui.js', 'gps_ui.js', 'workflow_v2_ui.js', 'gps_map_ui.js']) {
  const source = path.join(ROOT, file);
  const target = path.join(publicDir, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
}

// server.js contiene la aplicación Express y abre un único listener.
// server_boot.js conserva el punto de entrada usado por Render y CI.
require('./server_boot');

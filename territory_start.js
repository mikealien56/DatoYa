// DatoYa territory bootstrap / static server
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const publicDir = path.join(ROOT, 'public');
fs.mkdirSync(publicDir, { recursive: true });
for (const file of ['index.html','datoya-logo.svg','app.js','styles.css','role_ui_fix.js','admin_v2_ui.js','protection_ui.js','gps_ui.js','workflow_v2_ui.js','gps_map_ui.js']) {
  const source=path.join(ROOT,file), target=path.join(publicDir,file);
  if(fs.existsSync(source)) fs.copyFileSync(source,target);
}
// Capa runtime que conserva server.js y agrega funciones V2 sin reconstruirlo.
require('./admin_v2_bootstrap');

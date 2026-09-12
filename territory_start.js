// DatoYa territory bootstrap / static server
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = __dirname;
const publicDir = path.join(ROOT, 'public');
fs.mkdirSync(publicDir, { recursive: true });

for (const file of ['index.html', 'datoya-logo.svg', 'app.js', 'styles.css', 'protection_ui.js', 'gps_ui.js', 'workflow_v2_ui.js', 'gps_map_ui.js']) {
  const source = path.join(ROOT, file);
  const target = path.join(publicDir, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
}

const server = require('./server');

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`DatoYa escuchando en ${port}`);
});

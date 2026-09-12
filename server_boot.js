// DatoYa — bootstrap del servidor
// server.js contiene la aplicación Express pero no inicia el listener por sí solo.
// Este bootstrap la ejecuta y conecta el listener al PORT de Render/CI.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const filename = path.join(__dirname, 'server.js');
const code = fs.readFileSync(filename, 'utf8') + `\n\napp.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {\n  console.log('[DatoYa] Servidor escuchando en ' + Number(process.env.PORT || 3000));\n});\n`;

const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(__dirname);
mod._compile(code, filename);

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
fs.copyFileSync(path.join(__dirname,'client_diagnostics.js'),path.join(pub,'client_diagnostics.js'));
const idx=path.join(pub,'index.html');
let html=fs.readFileSync(idx,'utf8');
html=html.replace(/<script[^>]+src="\/client_diagnostics\.js[^"]*"[^>]*><\/script>\s*/g,'');
html=html.replace('</body>','<script src="/client_diagnostics.js?v=20260923-1"></script>\n</body>');
fs.writeFileSync(idx,html);
console.log('[DatoYa] Diagnóstico temporal de navegador activo.');

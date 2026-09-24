const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
fs.copyFileSync(path.join(__dirname,'final_route_ready.js'),path.join(pub,'final_route_ready.js'));
const idx=path.join(pub,'index.html');
let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<script[^>]+src="\/final_route_ready\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</body>','<script src="/final_route_ready.js?v=20260923-1"></script>\n</body>');
fs.writeFileSync(idx,h);
console.log('[DatoYa] Pasada final de rutas SPA preparada.');

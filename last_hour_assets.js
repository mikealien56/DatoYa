// DatoYa Última Hora: montar assets después del resto de capas y rutas.
'use strict';
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['last_hour.css','last_hour_ui.js']){
  const src=path.join(__dirname,name);
  if(!fs.existsSync(src))throw new Error('Falta archivo: '+name);
  fs.copyFileSync(src,path.join(pub,name));
}
const idx=path.join(pub,'index.html');
if(!fs.existsSync(idx))throw new Error('Falta index.html de DatoYa');
let html=fs.readFileSync(idx,'utf8');
html=html.replace(/<link[^>]+href="\/last_hour\.css[^"]*"[^>]*>\s*/g,'');
html=html.replace(/<script[^>]+src="\/last_hour_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
if(!html.includes('</head>')||!html.includes('</body>'))throw new Error('Documento web incompleto');
html=html.replace('</head>','<link rel="stylesheet" href="/last_hour.css?v=20261019-visible2">\n</head>');
html=html.replace('</body>','<script src="/last_hour_ui.js?v=20261019-visible2"></script>\n</body>');
fs.writeFileSync(idx,html);
console.log('[DatoYa] Pantallas Última Hora preparadas.');

'use strict';
// Registra la vitrina de nuevos negocios en la portada servida por Render.
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_welcome_ui.js','marketplace_welcome.css']){
  fs.copyFileSync(path.join(__dirname,name),path.join(pub,name));
}
const index=path.join(pub,'index.html');
let html=fs.readFileSync(index,'utf8');
html=html.replace(/<link[^>]+href="\/marketplace_welcome\.css[^"]*"[^>]*>\s*/g,'');
html=html.replace(/<script[^>]+src="\/marketplace_welcome_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_welcome.css?v=20261021-welcome-top4">\n</head>');
html=html.replace('</body>','<script src="/marketplace_welcome_ui.js?v=20261021-no-initial-square1"></script>\n</body>');
fs.writeFileSync(index,html);
console.log('[DatoYa] Galería de bienvenida de negocios cargada en portada.');

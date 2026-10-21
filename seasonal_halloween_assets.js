// DatoYa: capa visual Halloween 2026 al final de la secuencia de recursos.
const fs=require('fs');
const path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['seasonal_halloween.css','seasonal_halloween_ui.js']){
  fs.copyFileSync(path.join(root,name),path.join(pub,name));
}
const file=path.join(pub,'index.html');
if(fs.existsSync(file)){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link[^>]+href="\/seasonal_halloween\.css[^"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/seasonal_halloween_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/seasonal_halloween.css?v=20261021-premium1">\n</head>');
  html=html.replace('</body>','<script src="/seasonal_halloween_ui.js?v=20261021-premium1"></script>\n</body>');
  fs.writeFileSync(file,html);
}
console.log('[DatoYa] Capa Halloween temporal cargada, sin alterar la imagen de marca.');
/* Final-stage PWA install assets: do not ship a debug APK or a download URL. */
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['pwa_install_ui.js','pwa_install.css']){
  fs.copyFileSync(path.join(__dirname,name),path.join(pub,name));
}
const index=path.join(pub,'index.html');
if(fs.existsSync(index)){
  let html=fs.readFileSync(index,'utf8');
  html=html.replace(/<link[^>]+href="\/pwa_install\.css[^"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/pwa_install_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/pwa_install.css?v=20261020-install1">\n</head>');
  html=html.replace('</body>','<script defer src="/pwa_install_ui.js?v=20261020-install1"></script>\n</body>');
  fs.writeFileSync(index,html);
}
console.log('[DatoYa] Instalación PWA nativa desde datoya.cl preparada.');

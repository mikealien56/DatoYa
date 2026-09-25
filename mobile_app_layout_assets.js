// DatoYa — publica la capa responsive final después de todos los demás assets.
const fs=require('fs');
const path=require('path');
const publicDir=path.join(__dirname,'public');
const cssName='mobile_app_layout.css';
fs.copyFileSync(path.join(__dirname,cssName),path.join(publicDir,cssName));
const indexPath=path.join(publicDir,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
html=html.replace(/<link[^>]+href="\/mobile_app_layout\.css[^"]*"[^>]*>\s*/g,'');
// No forzar cambios de host desde JavaScript. Cloudflare/Render resuelven el dominio;
// así evitamos bucles datoya.cl <-> www.datoya.cl o redirecciones desde onrender.
html=html.replace(/<script id="dy-canonical-domain">[\s\S]*?<\/script>\s*/g,'');
html=html.replace('</head>','  <link rel="stylesheet" href="/mobile_app_layout.css?v=20260925-2">\n</head>');
fs.writeFileSync(indexPath,html);
console.log('[DatoYa] Capa responsive PWA final preparada sin redirección canónica en cliente.');

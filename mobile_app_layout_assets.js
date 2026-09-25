// DatoYa — publica la capa responsive final después de todos los demás assets.
const fs=require('fs');
const path=require('path');
const publicDir=path.join(__dirname,'public');
const cssName='mobile_app_layout.css';
fs.copyFileSync(path.join(__dirname,cssName),path.join(publicDir,cssName));
const indexPath=path.join(publicDir,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
html=html.replace(/<link[^>]+href="\/mobile_app_layout\.css[^"]*"[^>]*>\s*/g,'');
html=html.replace(/<script id="dy-canonical-domain">[\s\S]*?<\/script>\s*/g,'');
const canonical='<script id="dy-canonical-domain">(()=>{const h=location.hostname;if(h==="datoya.onrender.com"||h==="www.datoya.cl"){location.replace("https://datoya.cl"+location.pathname+location.search+location.hash)}})();<\/script>\n';
html=html.replace('</head>',canonical+'  <link rel="stylesheet" href="/mobile_app_layout.css?v=20260925-1">\n</head>');
fs.writeFileSync(indexPath,html);
console.log('[DatoYa] Capa responsive PWA final preparada.');

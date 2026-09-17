const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
function copyDir(source,target){fs.mkdirSync(target,{recursive:true});for(const entry of fs.readdirSync(source,{withFileTypes:true})){const from=path.join(source,entry.name),to=path.join(target,entry.name);entry.isDirectory()?copyDir(from,to):fs.copyFileSync(from,to);}}
copyDir(path.join(root,'brand'),path.join(pub,'brand'));
for(const name of ['manifest.webmanifest','service-worker.js','brand_phase_a_ui.js'])fs.copyFileSync(path.join(root,name),path.join(pub,name));
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<script>\s*\(function\(\)\{[\s\S]*?clearBlackBackground[\s\S]*?<\/script>\s*/,'');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>DatoYa — Lo que buscas, cerca de ti</title>');
  html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="DatoYa te ayuda a descubrir negocios, productos y oportunidades cerca de ti.">');
  html=html.replace(/<link id="datoya-favicon"[^>]*>/,'<link id="datoya-favicon" rel="icon" href="/brand/pwa/favicon-32.png" type="image/png">');
  if(!html.includes('manifest.webmanifest'))html=html.replace('</head>','<link rel="manifest" href="/manifest.webmanifest">\n<meta name="theme-color" content="#0B3A82">\n<link rel="apple-touch-icon" href="/brand/pwa/icon-192.png">\n</head>');
  if(!html.includes('/brand_phase_a_ui.js'))html=html.replace('</body>','<script src="/brand_phase_a_ui.js?v=1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

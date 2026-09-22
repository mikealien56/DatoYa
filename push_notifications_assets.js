// DatoYa — publica el Service Worker y manifest finales después de ensamblar la PWA.
const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['service-worker.js','manifest.webmanifest']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  if(!/rel=["']manifest["']/i.test(html))html=html.replace('</head>','<link rel="manifest" href="/manifest.webmanifest">\n</head>');
  fs.writeFileSync(idx,html);
}

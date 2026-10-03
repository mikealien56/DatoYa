const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['customer_club_ui.js','customer_club.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}

const brandDir=path.join(pub,'brand');fs.mkdirSync(brandDir,{recursive:true});
const webp=path.join(__dirname,'brand','datoya-club-card.webp');
if(fs.existsSync(webp))fs.copyFileSync(webp,path.join(brandDir,'datoya-club-card.webp'));

// Tarjeta DatoYa Club nueva: se reconstruye desde partes base64 para evitar corrupción binaria en Git.
const clubV12Parts=[0,1,2,3,4,5].map(i=>path.join(__dirname,'brand',`datoya-club-card-v12.webp.b64.${i}`));
if(clubV12Parts.every(fs.existsSync)){
  const encoded=clubV12Parts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  const binary=Buffer.from(encoded,'base64');
  const valid=binary.length>10000&&binary.subarray(0,4).toString('ascii')==='RIFF'&&binary.subarray(8,12).toString('ascii')==='WEBP';
  if(!valid)throw new Error('DatoYa Club card v12 inválida');
  fs.writeFileSync(path.join(brandDir,'datoya-club-card-v12.webp'),binary);
  console.log('[DatoYa] Tarjeta Club v12 publicada: '+binary.length+' bytes.');
}
// Conserva AVIF solo como formato opcional; la UI usa WebP por compatibilidad.
const premiumParts=[0,1,2,3,4].map(i=>path.join(__dirname,'brand',`datoya-club-card.avif.b64.${i}`));
if(premiumParts.every(fs.existsSync)){
  const encoded=premiumParts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(path.join(brandDir,'datoya-club-card.avif'),Buffer.from(encoded,'base64'));
}

const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/customer_club\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/customer_club_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/customer_club.css?v=20261003-12">\n</head>');
h=h.replace('</body>','<script src="/customer_club_ui.js?v=20261003-12"></script>\n</body>');
fs.writeFileSync(idx,h);}

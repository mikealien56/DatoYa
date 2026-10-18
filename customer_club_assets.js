const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['customer_club_ui.js','customer_club.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}

const brandDir=path.join(pub,'brand');fs.mkdirSync(brandDir,{recursive:true});
const webp=path.join(__dirname,'brand','datoya-club-card.webp');
if(fs.existsSync(webp))fs.copyFileSync(webp,path.join(brandDir,'datoya-club-card.webp'));

// Tarjeta DatoYa Club verificada: binario WebP real dentro del repositorio.
const clubV13=path.join(__dirname,'brand','datoya-club-card-v13.webp');
if(!fs.existsSync(clubV13))throw new Error('Falta la tarjeta DatoYa Club v13');
const clubV13Binary=fs.readFileSync(clubV13);
const clubV13Valid=clubV13Binary.length>10000&&clubV13Binary.subarray(0,4).toString('ascii')==='RIFF'&&clubV13Binary.subarray(8,12).toString('ascii')==='WEBP';
if(!clubV13Valid)throw new Error('DatoYa Club card v13 inválida');
fs.copyFileSync(clubV13,path.join(brandDir,'datoya-club-card-v13.webp'));
console.log('[DatoYa] Tarjeta Club v13 publicada: '+clubV13Binary.length+' bytes.');
// Conserva AVIF solo como formato opcional; la UI usa WebP por compatibilidad.
const premiumParts=[0,1,2,3,4].map(i=>path.join(__dirname,'brand',`datoya-club-card.avif.b64.${i}`));
if(premiumParts.every(fs.existsSync)){
  const encoded=premiumParts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(path.join(brandDir,'datoya-club-card.avif'),Buffer.from(encoded,'base64'));
}

// Tarjeta Club WebP compatible con Android, 520 x 347.
const visibleParts=[0,1,2,3].map(i=>path.join(__dirname,'brand','datoya-club-card-v10.webp.b64.'+i));
if(!visibleParts.every(fs.existsSync))throw new Error('Faltan fragmentos de la tarjeta Club WebP');
const visibleBinary=Buffer.from(visibleParts.map(p=>fs.readFileSync(p,'utf8').trim()).join(''),'base64');
const isWebp=visibleBinary.length>20000&&visibleBinary.subarray(0,4).toString('ascii')==='RIFF'&&visibleBinary.subarray(8,12).toString('ascii')==='WEBP';
if(!isWebp)throw new Error('Tarjeta DatoYa Club WebP inválida');
fs.writeFileSync(path.join(brandDir,'datoya-club-card-visible.webp'),visibleBinary);
console.log('[DatoYa] Tarjeta Club WebP visible publicada: '+visibleBinary.length+' bytes.');

// Publicar la tarjeta original DatoYa Club de alta nitidez (1536 x 1024).
const clubHQ=path.join(__dirname,'brand','datoya-club-card-hq-1536.webp');
if(!fs.existsSync(clubHQ))throw new Error('Falta imagen original DatoYa Club HQ');
const clubHQBinary=fs.readFileSync(clubHQ);
if(clubHQBinary.length<100000||clubHQBinary.subarray(0,4).toString('ascii')!=='RIFF'||clubHQBinary.subarray(8,12).toString('ascii')!=='WEBP')throw new Error('Tarjeta original DatoYa Club HQ inválida');
fs.copyFileSync(clubHQ,path.join(brandDir,'datoya-club-card-hq-1536.webp'));
console.log('[DatoYa] Tarjeta Club HQ 1536 publicada: '+clubHQBinary.length+' bytes.');

const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/customer_club\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/customer_club_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/customer_club.css?v=20261018-club-copy3">\n</head>');
h=h.replace('</body>','<script src="/customer_club_ui.js?v=20261018-club-copy3"></script>\n</body>');
fs.writeFileSync(idx,h);}

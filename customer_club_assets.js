const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['customer_club_ui.js','customer_club.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}

const brandDir=path.join(pub,'brand');fs.mkdirSync(brandDir,{recursive:true});
const webp=path.join(__dirname,'brand','datoya-club-card.webp');
if(fs.existsSync(webp)){fs.copyFileSync(webp,path.join(brandDir,'datoya-club-card.webp'));fs.copyFileSync(webp,path.join(brandDir,'datoya-club-card-v3.webp'));}
// Conserva AVIF solo como formato opcional; la UI usa WebP por compatibilidad.
const premiumParts=[0,1,2,3,4].map(i=>path.join(__dirname,'brand',`datoya-club-card.avif.b64.${i}`));
if(premiumParts.every(fs.existsSync)){
  const encoded=premiumParts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(path.join(brandDir,'datoya-club-card.avif'),Buffer.from(encoded,'base64'));
}

const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/customer_club\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/customer_club_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/customer_club.css?v=20261003-3">\n</head>');
h=h.replace('</body>','<script src="/customer_club_ui.js?v=20261003-3"></script>\n</body>');
fs.writeFileSync(idx,h);}

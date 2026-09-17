const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['local_market_home.css','local_market_home.js']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>DatoYa — Lo que buscas, cerca de ti</title>');
  html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="DatoYa te ayuda a descubrir negocios, productos, promociones y ventas activas cerca de ti.">');
  html=html.replace(/src="\/datoya-logo\.jpg[^\"]*"/g,'src="/brand/datoya-logo-horizontal.png?v=20260916"');
  if(!html.includes('/local_market_home.css'))html=html.replace('</head>','<link rel="stylesheet" href="/local_market_home.css?v=20260916-1">\n</head>');
  if(!html.includes('/local_market_home.js'))html=html.replace('</body>','<script src="/local_market_home.js?v=20260916-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

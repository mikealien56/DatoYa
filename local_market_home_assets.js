const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['local_market_home.css','local_market_home.js','local_market_home_guard.js','local_location_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>DatoYa — Lo que buscas, cerca de ti</title>');
  html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="DatoYa te ayuda a descubrir negocios, productos, promociones y ventas activas cerca de ti.">');
  html=html.replace(/src="\/datoya-logo\.jpg[^\"]*"/g,'src="/brand/datoya-logo-horizontal.png?v=20260917-3"');

  // Quitar cualquier inclusión previa para asegurar que estos assets queden realmente al final.
  html=html.replace(/<link[^>]+href="\/local_market_home\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home_guard\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_location_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');

  html=html.replace('</head>','<link rel="stylesheet" href="/local_market_home.css?v=20260917-3">\n</head>');
  html=html.replace('</body>','<script src="/local_market_home.js?v=20260917-3"></script>\n<script src="/local_market_home_guard.js?v=20260917-4"></script>\n<script src="/local_location_ui.js?v=20260917-4"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

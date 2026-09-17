const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['local_market_home.css','hero_polish.css','local_market_home.js','local_market_home_guard.js','local_location_ui.js','marketplace_navigation_fix.js']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>DatoYa — Lo que buscas, cerca de ti</title>');
  html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="DatoYa te ayuda a descubrir negocios, productos, promociones y ventas activas cerca de ti.">');
  html=html.replace(/src="\/datoya-logo\.jpg[^\"]*"/g,'src="/brand/datoya-logo-horizontal.png?v=20260917-3"');

  // Evita que el Home legacy alcance a verse antes de que cargue el marketplace nuevo.
  html=html.replace(/<style id="dy-market-boot-shield">[\s\S]*?<\/style>\s*/g,'');
  const bootShield='<style id="dy-market-boot-shield">html:not(.dy-market-ready) #view{visibility:hidden}html:not(.dy-market-ready) body::after{content:"Cargando DatoYa…";position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F7F9FC;color:#0B3A82;font:600 15px Poppins,system-ui,sans-serif;z-index:9999}</style>\n';

  // Quitar cualquier inclusión previa para asegurar que estos assets queden realmente al final.
  html=html.replace(/<link[^>]+href="\/local_market_home\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<link[^>]+href="\/hero_polish\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home_guard\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_location_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_navigation_fix\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script id="dy-market-reveal">[\s\S]*?<\/script>\s*/g,'');

  html=html.replace('</head>',bootShield+'<link rel="stylesheet" href="/local_market_home.css?v=20260917-4">\n<link rel="stylesheet" href="/hero_polish.css?v=20260917-1">\n</head>');
  const reveal=`<script id="dy-market-reveal">(()=>{const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';const reveal=()=>{if(!isHome()||document.querySelector('.dy-home')){document.documentElement.classList.add('dy-market-ready');return;}requestAnimationFrame(reveal)};reveal();addEventListener('hashchange',()=>{document.documentElement.classList.add('dy-market-ready')})})();</script>`;
  html=html.replace('</body>','<script src="/local_market_home.js?v=20260917-4"></script>\n<script src="/local_market_home_guard.js?v=20260917-4"></script>\n<script src="/local_location_ui.js?v=20260917-4"></script>\n<script src="/marketplace_navigation_fix.js?v=20260917-2"></script>\n'+reveal+'\n</body>');
  fs.writeFileSync(idx,html);
}

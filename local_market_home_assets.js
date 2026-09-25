const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['local_market_home.css','hero_polish.css','home_premium.css','local_market_home.js','local_market_home_guard.js','local_location_ui.js','marketplace_navigation_fix.js','marketplace_topnav_fix.js','home_premium_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>DatoYa — Lo que buscas, cerca de ti</title>');
  html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="DatoYa te ayuda a descubrir negocios, productos y promociones reales cerca de ti.">');
  html=html.replace(/src="\/datoya-logo\.jpg[^\"]*"/g,'src="/brand/datoya-logo-horizontal.png?v=20260917-3"');
  html=html.replace(/\/app\.js(?:\?v=\d+)?/g,'/app.js?v=5');

  html=html.replace(/<style id="dy-market-boot-shield">[\s\S]*?<\/style>\s*/g,'');
  const bootShield='<style id="dy-market-boot-shield">html:not(.dy-market-ready) #app{visibility:hidden}html:not(.dy-market-ready) body::after{content:"Cargando DatoYa…";position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F7F9FC;color:#0B3A82;font:600 15px Poppins,system-ui,sans-serif;z-index:9999}</style>\n';

  html=html.replace(/<link[^>]+href="\/local_market_home\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<link[^>]+href="\/hero_polish\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<link[^>]+href="\/home_premium\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_market_home_guard\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/local_location_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_navigation_fix\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_topnav_fix\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/home_premium_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script id="dy-market-reveal">[\s\S]*?<\/script>\s*/g,'');

  html=html.replace('</head>',bootShield+'<link rel="stylesheet" href="/local_market_home.css?v=20260917-5">\n<link rel="stylesheet" href="/hero_polish.css?v=20260917-2">\n<link rel="stylesheet" href="/home_premium.css?v=20260917-2">\n</head>');
  const reveal=`<script id="dy-market-reveal">(()=>{const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';const started=Date.now();const done=()=>document.documentElement.classList.add('dy-market-ready');const reveal=()=>{if(!isHome()||document.querySelector('.dy-home')||Date.now()-started>2500){done();return;}requestAnimationFrame(reveal)};reveal();setTimeout(done,3000);addEventListener('hashchange',done)})();<\/script>`;
  html=html.replace('</body>','<script src="/local_market_home.js?v=20260925-8"></script>\n<script src="/local_market_home_guard.js?v=20260917-7"></script>\n<script src="/local_location_ui.js?v=20260917-6"></script>\n<script src="/marketplace_navigation_fix.js?v=20260917-2"></script>\n<script src="/marketplace_topnav_fix.js?v=20260917-2"></script>\n<script src="/home_premium_ui.js?v=20260917-3"></script>\n'+reveal+'\n</body>');
  fs.writeFileSync(idx,html);
}

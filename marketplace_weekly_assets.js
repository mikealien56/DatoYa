const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_admin_market.css','marketplace_weekly_ui.js','marketplace_admin_market_ui.js','marketplace_weekly_home.js']){
  const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_admin_market\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_weekly_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_admin_market_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_weekly_home\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_admin_market.css?v=20260917-1">\n</head>');
  html=html.replace('</body>','<script src="/marketplace_weekly_ui.js?v=20260917-1"></script>\n<script src="/marketplace_admin_market_ui.js?v=20260917-1"></script>\n<script src="/marketplace_weekly_home.js?v=20260917-2"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

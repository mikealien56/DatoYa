const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const n of ['marketplace_coupons.css','marketplace_coupons_ui.js']){const s=path.join(root,n),d=path.join(pub,n);if(fs.existsSync(s))fs.copyFileSync(s,d);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_coupons\.css[^"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_coupons_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_coupons.css?v=20260927-1">\n</head>');
  html=html.replace('</body>','<script src="/marketplace_coupons_ui.js?v=20260927-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

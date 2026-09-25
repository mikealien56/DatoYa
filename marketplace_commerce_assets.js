const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_commerce.css','marketplace_commerce_ui.js','marketplace_impulse_home.js','marketplace_commerce_admin_ui.js','khipu_payments_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_commerce\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_commerce_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_impulse_home\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_commerce_admin_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/khipu_payments_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_commerce.css?v=20260925-7">\n</head>');
  html=html.replace('</body>','<script src="/marketplace_commerce_ui.js?v=20260925-2"></script>\n<script src="/marketplace_impulse_home.js?v=20260917-2"></script>\n<script src="/marketplace_commerce_admin_ui.js?v=20260917-1"></script>\n<script src="/khipu_payments_ui.js?v=20260925-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

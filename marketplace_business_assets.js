const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_business.css','product_photo_studio.js','marketplace_business_ui.js','marketplace_business_admin_ui.js','marketplace_public_beta.css','marketplace_public_beta_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_business\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<link[^>]+href="\/marketplace_public_beta\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/product_photo_studio\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_business_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_business_admin_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_public_beta_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_business.css?v=20261021-two-product-photos1">\n<link rel="stylesheet" href="/marketplace_public_beta.css?v=20261021-business-cover-fit1">\n</head>');
  html=html.replace('</body>','<script src="/product_photo_studio.js?v=20261018-cleanup-ui1"></script>\n<script src="/marketplace_business_ui.js?v=20261021-cover-help2"></script>\n<script src="/marketplace_business_admin_ui.js?v=20260917-2"></script>\n<script src="/marketplace_public_beta_ui.js?v=20261021-two-product-photos1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

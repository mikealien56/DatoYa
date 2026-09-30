const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_account.css','marketplace_account_ui.js','founder_welcome_ui.js','founder_welcome.css','founder_storefront.svg']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_account\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_account_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace(/<link[^>]+href="\/founder_welcome\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/founder_welcome_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_account.css?v=20260930-founder1">\n<link rel="stylesheet" href="/founder_welcome.css?v=20260930-1">\n</head>');
  html=html.replace('</body>','<script src="/founder_welcome_ui.js?v=20260930-1"></script>\n<script src="/marketplace_account_ui.js?v=20260930-founder1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

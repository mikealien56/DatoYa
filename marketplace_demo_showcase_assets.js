const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_demo_showcase.css','marketplace_demo_showcase_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/marketplace_demo_showcase\.css[^\"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/marketplace_demo_showcase_ui\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_demo_showcase.css?v=20260917-1">\n</head>');
  html=html.replace('</body>','<script src="/marketplace_demo_showcase_ui.js?v=20260917-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

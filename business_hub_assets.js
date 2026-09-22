const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['business_hub_ui.js','business_hub.css']){
  const src=path.join(root,name),dst=path.join(pub,name);
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/business_hub\.css[^"]*"[^>]*>\s*/g,'');
  html=html.replace(/<script[^>]+src="\/business_hub_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/business_hub.css?v=20260922-2">\n</head>');
  html=html.replace('</body>','<script src="/business_hub_ui.js?v=20260922-2"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

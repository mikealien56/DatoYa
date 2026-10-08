const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['payku_marketplace_ui.js','payku_marketplace.css']){
  const from=path.join(__dirname,name);
  if(fs.existsSync(from))fs.copyFileSync(from,path.join(pub,name));
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/payku_marketplace\.css[^"]*"[^>]*>\s*/g,'')
    .replace(/<script[^>]+src="\/payku_marketplace_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="/payku_marketplace.css?v=20261008-2">\n</head>');
  html=html.replace('</body>','<script src="/payku_marketplace_ui.js?v=20261008-2"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

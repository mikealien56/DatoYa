const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['beta_private_ui.js','beta_private_ui.css']){const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst)}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let html=fs.readFileSync(idx,'utf8');html=html.replace(/<link[^>]+href="\/beta_private_ui\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/beta_private_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');html=html.replace('</head>','<link rel="stylesheet" href="/beta_private_ui.css?v=20260922-4">\n</head>');html=html.replace('</body>','<script src="/beta_private_ui.js?v=20260922-4"></script>\n</body>');fs.writeFileSync(idx,html)}

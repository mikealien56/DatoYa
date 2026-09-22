const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['support_center_ui.js','business_support_ui.js','support_center.css']){const s=path.join(root,name),d=path.join(pub,name);if(fs.existsSync(s))fs.copyFileSync(s,d);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let html=fs.readFileSync(idx,'utf8');
html=html.replace(/<link[^>]+href="\/support_center\.css[^"]*"[^>]*>\s*/g,'');
html=html.replace(/<script[^>]+src="\/support_center_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
html=html.replace(/<script[^>]+src="\/business_support_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
html=html.replace('</head>','<link rel="stylesheet" href="/support_center.css?v=20260922-1">\n</head>');
html=html.replace('</body>','<script src="/support_center_ui.js?v=20260922-1"></script>\n<script src="/business_support_ui.js?v=20260922-1"></script>\n</body>');
fs.writeFileSync(idx,html);}

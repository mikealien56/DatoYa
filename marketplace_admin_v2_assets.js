const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_admin_v2_ui.js','marketplace_admin_v2.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/marketplace_admin_v2\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/marketplace_admin_v2_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/marketplace_admin_v2.css?v=20260921-1">\n</head>');
h=h.replace('</body>','<script src="/marketplace_admin_v2_ui.js?v=20260921-1"></script>\n</body>');
fs.writeFileSync(idx,h);}

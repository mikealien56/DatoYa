const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['business_growth_plans_v2_ui.js','business_growth_plans_v2.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/business_growth_plans_v2\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/business_growth_plans_v2_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/business_growth_plans_v2.css?v=20261001-1">\n</head>');
h=h.replace('</body>','<script src="/business_growth_plans_v2_ui.js?v=20261009-mp1"></script>\n</body>');
fs.writeFileSync(idx,h);}

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['business_impulse_plan_ui.js','business_impulse_plan.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/business_impulse_plan\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/business_impulse_plan_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/business_impulse_plan.css?v=20260922-4">\n</head>');
h=h.replace('</body>','<script src="/business_impulse_plan_ui.js?v=20260923-1"></script>\n</body>');
fs.writeFileSync(idx,h);}

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['home_clarity_v2.js','home_clarity_v2.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/home_clarity_v2\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/home_clarity_v2\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/home_clarity_v2.css?v=20261001-1">\n</head>');
h=h.replace('</body>','<script src="/home_clarity_v2.js?v=20261001-1"></script>\n</body>');
fs.writeFileSync(idx,h);}

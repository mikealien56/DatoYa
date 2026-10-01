const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['home_structure_v3.js','home_structure_v3.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/home_structure_v3\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/home_structure_v3\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/home_structure_v3.css?v=20261001-1">\n</head>');
h=h.replace('</body>','<script src="/home_structure_v3.js?v=20261001-1"></script>\n</body>');
fs.writeFileSync(idx,h);}

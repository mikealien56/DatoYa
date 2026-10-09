const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['direct_merchant_payments_ui.js','direct_merchant_payments.css']){const s=path.join(__dirname,name);if(fs.existsSync(s))fs.copyFileSync(s,path.join(pub,name));}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');
h=h.replace(/<link[^>]+href="\/direct_merchant_payments\.css[^"]*"[^>]*>\s*/g,'').replace(/<script[^>]+src="\/direct_merchant_payments_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
h=h.replace('</head>','<link rel="stylesheet" href="/direct_merchant_payments.css?v=20261008-1">\n</head>');
h=h.replace('</body>','<script src="/direct_merchant_payments_ui.js?v=20261009-mpcleanup1"></script>\n</body>');
fs.writeFileSync(idx,h);}

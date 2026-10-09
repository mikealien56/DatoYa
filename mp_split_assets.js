'use strict';
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['mp_split_ui.js','mp_split.css']){
  const input=path.join(__dirname,name);
  if(!fs.existsSync(input))throw new Error('No existe asset MP: '+name);
  fs.copyFileSync(input,path.join(pub,name));
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let s=fs.readFileSync(idx,'utf8');
  s=s.replace(/<link[^>]*href="\/mp_split\.css[^"]*"[^>]*>\s*/g,'')
    .replace(/<script[^>]*src="\/mp_split_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  if(!s.includes('</head>')||!s.includes('</body>'))throw new Error('Falta HTML para MP');
  s=s.replace('</head>','<link rel="stylesheet" href="/mp_split.css?v=20261009-2">\n</head>');
  s=s.replace('</body>','<script src="/mp_split_ui.js?v=20261009-card1"></script>\n</body>');
  fs.writeFileSync(idx,s);
}

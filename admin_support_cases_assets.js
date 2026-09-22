const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public'),src=path.join(__dirname,'admin_support_cases_ui.js'),dst=path.join(pub,'admin_support_cases_ui.js');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');h=h.replace(/<script src="\/admin_support_cases_ui\.js(?:\?v=[^"]*)?"><\/script>\s*/g,'');h=h.replace('</body>','<script src="/admin_support_cases_ui.js?v=20260922-1"></script>\n</body>');fs.writeFileSync(idx,h);}

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public'),src=path.join(__dirname,'admin_revenue_ui.js'),dst=path.join(pub,'admin_revenue_ui.js'),idx=path.join(pub,'index.html');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');h=h.replace(/<script src="\/admin_revenue_ui\.js(?:\?v=\d+)?"><\/script>\s*/g,'');h=h.replace('</body>','<script src="/admin_revenue_ui.js?v=1"></script>\n</body>');fs.writeFileSync(idx,h);}

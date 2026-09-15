const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public'),src=path.join(__dirname,'worker_onboarding_ui_fix.js'),dst=path.join(pub,'worker_onboarding_ui_fix.js'),idx=path.join(pub,'index.html');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');if(!h.includes('/worker_onboarding_ui_fix.js'))h=h.replace('</body>','<script src="/worker_onboarding_ui_fix.js?v=2"></script>\n</body>');else h=h.replace(/\/worker_onboarding_ui_fix\.js(?:\?v=\d+)?/g,'/worker_onboarding_ui_fix.js?v=2');fs.writeFileSync(idx,h);}

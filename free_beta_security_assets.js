const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'free_beta_security_ui.js');
const dst=path.join(pub,'free_beta_security_ui.js');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){let html=fs.readFileSync(idx,'utf8');if(!html.includes('/free_beta_security_ui.js'))html=html.replace('</body>','<script src="/free_beta_security_ui.js?v=3"></script>\n</body>');else html=html.replace(/\/free_beta_security_ui\.js(?:\?v=\d+)?/g,'/free_beta_security_ui.js?v=3');fs.writeFileSync(idx,html);}

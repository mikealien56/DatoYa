const fs=require('fs'),path=require('path'),pub=path.join(__dirname,'public'),src=path.join(__dirname,'job_record_ui.js');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,path.join(pub,'job_record_ui.js'))}
const idx=path.join(pub,'index.html');if(fs.existsSync(idx)){let h=fs.readFileSync(idx,'utf8');if(!h.includes('/job_record_ui.js'))h=h.replace('</body>','<script src="/job_record_ui.js?v=1"></script>\n</body>');else h=h.replace(/\/job_record_ui\.js(?:\?v=\d+)?/g,'/job_record_ui.js?v=1');fs.writeFileSync(idx,h)}

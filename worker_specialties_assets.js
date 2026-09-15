const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'worker_specialties_ui.js');
const dst=path.join(pub,'worker_specialties_ui.js');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
 let h=fs.readFileSync(idx,'utf8');
 if(!h.includes('/worker_specialties_ui.js')) h=h.replace('</body>','<script src="/worker_specialties_ui.js?v=2"></script>\n</body>');
 else h=h.replace(/\/worker_specialties_ui\.js(?:\?v=\d+)?/g,'/worker_specialties_ui.js?v=2');
 fs.writeFileSync(idx,h);
}

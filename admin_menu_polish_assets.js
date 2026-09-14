const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'admin_menu_polish.js');
const dst=path.join(pub,'admin_menu_polish.js');
if(fs.existsSync(src)){fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(src,dst);}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
 let h=fs.readFileSync(idx,'utf8');
 if(!h.includes('/admin_menu_polish.js')) h=h.replace('</body>','<script src="/admin_menu_polish.js?v=1"></script>\n</body>');
 else h=h.replace(/\/admin_menu_polish\.js(?:\?v=\d+)?/g,'/admin_menu_polish.js?v=1');
 fs.writeFileSync(idx,h);
}

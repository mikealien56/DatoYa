// DatoYa 2.0 — publica la UI para regalar PRO desde el panel admin
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const publicDir=path.join(ROOT,'public');
fs.mkdirSync(publicDir,{recursive:true});
const source=path.join(ROOT,'admin_pro_gift_ui.js');
const target=path.join(publicDir,'admin_pro_gift_ui.js');
if(fs.existsSync(source)) fs.copyFileSync(source,target);
const indexPath=path.join(publicDir,'index.html');
if(fs.existsSync(indexPath)){
  let html=fs.readFileSync(indexPath,'utf8');
  if(!html.includes('/admin_pro_gift_ui.js')) html=html.replace('</body>','<script src="/admin_pro_gift_ui.js?v=2"></script>\n</body>');
  else html=html.replace(/\/admin_pro_gift_ui\.js(?:\?v=\d+)?/g,'/admin_pro_gift_ui.js?v=2');
  fs.writeFileSync(indexPath,html);
}

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'admin_command_center_ui.js');
const dst=path.join(pub,'admin_command_center_ui.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let h=fs.readFileSync(idx,'utf8');
  if(!h.includes('/admin_command_center_ui.js')) h=h.replace('</body>','<script src="/admin_command_center_ui.js?v=2"></script>\n</body>');
  else h=h.replace(/\/admin_command_center_ui\.js(?:\?v=\d+)?/g,'/admin_command_center_ui.js?v=2');
  fs.writeFileSync(idx,h);
}

const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'worker_profile_fix.js');
const dst=path.join(pub,'worker_profile_fix.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let h=fs.readFileSync(idx,'utf8');
  h=h.replace(/\/worker_profile_fix\.js(?:\?v=\d+)?/g,'/worker_profile_fix.js?v=6');
  fs.writeFileSync(idx,h);
}

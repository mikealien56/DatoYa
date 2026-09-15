const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'job_detail_ui.js');
const dst=path.join(pub,'job_detail_ui.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let h=fs.readFileSync(idx,'utf8');
  if(!h.includes('/job_detail_ui.js')) h=h.replace('</body>','<script src="/job_detail_ui.js?v=4"></script>\n</body>');
  else h=h.replace(/\/job_detail_ui\.js(?:\?v=\d+)?/g,'/job_detail_ui.js?v=4');
  fs.writeFileSync(idx,h);
}

const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'job_trust_center_ui.js');
const dst=path.join(pub,'job_trust_center_ui.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let h=fs.readFileSync(idx,'utf8');
  if(/\/job_trust_center_ui\.js\?v=\d+/.test(h)){
    h=h.replace(/\/job_trust_center_ui\.js\?v=\d+/g,'/job_trust_center_ui.js?v=2');
  }else if(!h.includes('/job_trust_center_ui.js')){
    h=h.replace('</body>','<script src="/job_trust_center_ui.js?v=2"></script>\n</body>');
  }
  fs.writeFileSync(idx,h);
}

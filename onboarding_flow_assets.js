const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'onboarding_flow_ui.js');
const dst=path.join(pub,'onboarding_flow_ui.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  if(!html.includes('/onboarding_flow_ui.js')) html=html.replace('</body>','<script src="/onboarding_flow_ui.js?v=3"></script>\n</body>');
  else html=html.replace(/\/onboarding_flow_ui\.js(?:\?v=\d+)?/g,'/onboarding_flow_ui.js?v=3');
  fs.writeFileSync(idx,html);
}

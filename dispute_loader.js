// DatoYa 2.0 — composición autocontenida del ciclo de disputas.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const publicDir=path.join(ROOT,'public');

require('./dispute_schema');
require('./dispute_runtime_fix');

for(const file of ['dispute_ui.js','admin_dispute_ui_fix.js']){
  const source=path.join(ROOT,file),target=path.join(publicDir,file);
  if(fs.existsSync(source))fs.copyFileSync(source,target);
}

const index=path.join(publicDir,'index.html');
if(fs.existsSync(index)){
  let html=fs.readFileSync(index,'utf8');
  if(!html.includes('/dispute_ui.js'))html=html.replace('</body>','<script src="/dispute_ui.js?v=1"></script>\n</body>');
  else html=html.replace(/\/dispute_ui\.js(?:\?v=\d+)?/g,'/dispute_ui.js?v=1');
  if(!html.includes('/admin_dispute_ui_fix.js'))html=html.replace('</body>','<script src="/admin_dispute_ui_fix.js?v=1"></script>\n</body>');
  else html=html.replace(/\/admin_dispute_ui_fix\.js(?:\?v=\d+)?/g,'/admin_dispute_ui_fix.js?v=1');
  fs.writeFileSync(index,html);
}

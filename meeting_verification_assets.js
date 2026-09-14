// Publica la UI de encuentro verificado en public/ e inyecta el script al final.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const publicDir=path.join(ROOT,'public');
const source=path.join(ROOT,'meeting_verification_ui.js');
const target=path.join(publicDir,'meeting_verification_ui.js');
if(fs.existsSync(source)){
  fs.mkdirSync(publicDir,{recursive:true});
  fs.copyFileSync(source,target);
}
const indexFile=path.join(publicDir,'index.html');
if(fs.existsSync(indexFile)){
  let html=fs.readFileSync(indexFile,'utf8');
  if(!html.includes('/meeting_verification_ui.js')){
    html=html.replace('</body>','<script src="/meeting_verification_ui.js?v=1"></script>\n</body>');
    fs.writeFileSync(indexFile,html);
  }
}

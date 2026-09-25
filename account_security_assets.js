// Publica la UI de seguridad después de que territory_start haya preparado public/.
const fs=require('fs');
const path=require('path');
const root=__dirname;
const pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
const source=path.join(root,'account_security_ui.js');
const target=path.join(pub,'account_security_ui.js');
if(fs.existsSync(source)) fs.copyFileSync(source,target);
const indexPath=path.join(pub,'index.html');
if(fs.existsSync(indexPath)){
  let html=fs.readFileSync(indexPath,'utf8');
  html=html.replace(/<script[^>]+src="\/account_security_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</body>','<script src="/account_security_ui.js?v=5"></script>\n</body>');
  fs.writeFileSync(indexPath,html);
}

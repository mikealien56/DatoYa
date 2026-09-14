// Ajusta los enlaces de correo al router por segmentos de la SPA.
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'server.js');
if(fs.existsSync(file)){
  let src=fs.readFileSync(file,'utf8');
  src=src.replace("/#/restablecer?token='+encodeURIComponent(token)","/#/restablecer/'+encodeURIComponent(token)");
  src=src.replace("/#/verificar-correo?token='+encodeURIComponent(token)","/#/verificar-correo/'+encodeURIComponent(token)");
  fs.writeFileSync(file,src);
}

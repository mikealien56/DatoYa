// DatoYa — publica la UI de Mercado Pago después de que territory_start termina de componer index.html.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const publicDir=path.join(ROOT,'public');
fs.mkdirSync(publicDir,{recursive:true});
const source=path.join(ROOT,'mercadopago_ui.js');
const target=path.join(publicDir,'mercadopago_ui.js');
if(fs.existsSync(source))fs.copyFileSync(source,target);
const index=path.join(publicDir,'index.html');
if(fs.existsSync(index)){
  let html=fs.readFileSync(index,'utf8');
  html=html.replace(/<script src="\/mercadopago_ui\.js(?:\?v=\d+)?"><\/script>\s*/g,'');
  html=html.replace('</body>','<script src="/mercadopago_ui.js?v=1"></script>\n</body>');
  fs.writeFileSync(index,html);
}

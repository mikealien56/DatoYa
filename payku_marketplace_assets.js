const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['payku_marketplace_ui.js','payku_marketplace.css']){
  const from=path.join(__dirname,name);
  if(fs.existsSync(from))fs.copyFileSync(from,path.join(pub,name));
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<link[^>]+href="\/payku_marketplace\.css[^"]*"[^>]*>\s*/g,'')
    .replace(/<script[^>]+src="\/payku_marketplace_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  // Retire Payku UI while retaining compatibility for old transaction/history data.
  // Mercado Pago Split is installed separately by mp_split_assets.js.
  fs.writeFileSync(idx,html);
}

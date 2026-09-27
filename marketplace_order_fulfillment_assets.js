const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
const name='marketplace_order_fulfillment_ui.js',src=path.join(root,name),dst=path.join(pub,name);
if(fs.existsSync(src))fs.copyFileSync(src,dst);
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<script[^>]+src="\/marketplace_order_fulfillment_ui\.js[^"]*"[^>]*><\/script>\s*/g,'');
  html=html.replace('</body>','<script src="/marketplace_order_fulfillment_ui.js?v=20260927-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

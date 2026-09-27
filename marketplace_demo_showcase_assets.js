// DatoYa — limpieza de los escaparates ficticios antes de la beta real.
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  for(const css of ['marketplace_demo_showcase','marketplace_demo_pitch']){
    html=html.replace(new RegExp('<link[^>]+href="\\/'+css+'\\.css[^"]*"[^>]*>\\s*','g'),'');
  }
  for(const js of ['marketplace_demo_showcase_ui','marketplace_demo_pitch_ui']){
    html=html.replace(new RegExp('<script[^>]+src="\\/'+js+'\\.js[^"]*"[^>]*><\\/script>\\s*','g'),'');
  }
  fs.writeFileSync(idx,html);
}
for(const name of ['marketplace_demo_showcase.css','marketplace_demo_pitch.css','marketplace_demo_showcase_ui.js','marketplace_demo_pitch_ui.js']){
  const file=path.join(pub,name);
  try{if(fs.existsSync(file))fs.unlinkSync(file);}catch(_){}
}

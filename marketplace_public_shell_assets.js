// DatoYa — asegura que producción no exponga rutas visuales del frontend legacy.
const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
fs.mkdirSync(pub,{recursive:true});
const src=path.join(root,'marketplace_legacy_route_guard.js'),dst=path.join(pub,'marketplace_legacy_route_guard.js');
if(fs.existsSync(src))fs.copyFileSync(src,dst);
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  html=html.replace(/<script[^>]+src="\/marketplace_legacy_route_guard\.js[^\"]*"[^>]*><\/script>\s*/g,'');
  // Estas capas pertenecen únicamente a la antigua experiencia de maestros/trabajos.
  for(const name of ['chat_ui_fix','home_request_fix','worker_own_profile_ui','role_ui_fix','worker_v2_ui','protection_ui','gps_ui','workflow_v2_ui','gps_map_ui']){
    const re=new RegExp('<script[^>]+src="\\/'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.js[^\"]*"[^>]*><\\/script>\\s*','g');
    html=html.replace(re,'');
  }
  html=html.replace('</body>','<script src="/marketplace_legacy_route_guard.js?v=20260917-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

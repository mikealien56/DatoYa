// DatoYa territory bootstrap / static server
const fs=require('fs'); const path=require('path'); const ROOT=__dirname; const publicDir=path.join(ROOT,'public'); fs.mkdirSync(publicDir,{recursive:true});
for(const file of ['index.html','datoya-logo.svg','app.js','styles.css','role_ui_fix.js','admin_v2_ui.js','worker_v2_ui.js','request_photos_ui.js','protection_ui.js','gps_ui.js','workflow_v2_ui.js','gps_map_ui.js','evidence_ui.js','verification_admin_ui.js','verification_worker_ui.js','request_target_ui.js']){const source=path.join(ROOT,file),target=path.join(publicDir,file);if(fs.existsSync(source))fs.copyFileSync(source,target)}
const indexTarget=path.join(publicDir,'index.html');
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/request_photos_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/request_photos_ui.js"></script>\n</body>'));}
// Evidencias de trabajos: se cargan como módulo UI desde el frontend.
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/evidence_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/evidence_ui.js?v=2"></script>\n</body>'));}
// Verificación avanzada: revisión administrativa y respuesta del profesional.
if(fs.existsSync(indexTarget)){
  let html=fs.readFileSync(indexTarget,'utf8');
  if(!html.includes('/verification_admin_ui.js')) html=html.replace('</body>','<script src="/verification_admin_ui.js?v=1"></script>\n</body>');
  if(!html.includes('/verification_worker_ui.js')) html=html.replace('</body>','<script src="/verification_worker_ui.js?v=1"></script>\n</body>');
  if(!html.includes('/request_target_ui.js')) html=html.replace('</body>','<script src="/request_target_ui.js?v=1"></script>\n</body>');
  fs.writeFileSync(indexTarget,html);
}
// Componer denuncias/fotos/evidencias/admin/verificación antes de cargar el servidor real.
require('./reports_bootstrap');
require('./request_target_bootstrap');
require('./server');

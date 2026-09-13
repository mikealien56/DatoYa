// DatoYa territory bootstrap / static server
const fs=require('fs'); const path=require('path'); const ROOT=__dirname; const publicDir=path.join(ROOT,'public'); fs.mkdirSync(publicDir,{recursive:true});
// Corrige el frontend antes de copiarlo a public/ para evitar que un error de sintaxis deje la app en blanco.
require('./app_runtime_fix');
for(const file of ['index.html','datoya-logo.svg','app.js','styles.css','role_ui_fix.js','admin_v2_ui.js','admin_v3_fix.js','worker_v2_ui.js','worker_profile_fix.js','worker_portfolio_ui.js','request_photos_ui.js','protection_ui.js','gps_ui.js','workflow_v2_ui.js','gps_map_ui.js','evidence_ui.js','verification_admin_ui.js','verification_worker_ui.js','request_target_ui.js']){const source=path.join(ROOT,file),target=path.join(publicDir,file);if(fs.existsSync(source))fs.copyFileSync(source,target)}
const indexTarget=path.join(publicDir,'index.html');
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/request_photos_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/request_photos_ui.js"></script>\n</body>'));}
// Evidencias de trabajos: se cargan como módulo UI desde el frontend.
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/evidence_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/evidence_ui.js?v=2"></script>\n</body>'));}
// Verificación avanzada: revisión administrativa y respuesta del profesional.
if(fs.existsSync(indexTarget)){
  let html=fs.readFileSync(indexTarget,'utf8');
  if(!html.includes('/verification_admin_ui.js')) html=html.replace('</body>','<script src="/verification_admin_ui.js?v=1"></script>\n</body>');
  if(!html.includes('/verification_worker_ui.js')) html=html.replace('</body>','<script src="/verification_worker_ui.js?v=1"></script>\n</body>');
  if(!html.includes('/request_target_ui.js')) html=html.replace('</body>','<script src="/request_target_ui.js?v=3"></script>\n</body>');
  if(!html.includes('/admin_v3_fix.js')) html=html.replace('</body>','<script src="/admin_v3_fix.js?v=2"></script>\n</body>');
  else html=html.replace(/\/admin_v3_fix\.js(?:\?v=\d+)?/g,'/admin_v3_fix.js?v=2');
  if(!html.includes('/worker_profile_fix.js')) html=html.replace('</body>','<script src="/worker_profile_fix.js?v=1"></script>\n</body>');
  else html=html.replace(/\/worker_profile_fix\.js(?:\?v=\d+)?/g,'/worker_profile_fix.js?v=4');
  if(!html.includes('/worker_portfolio_ui.js')) html=html.replace('</body>','<script src="/worker_portfolio_ui.js?v=1"></script>\n</body>');
  else html=html.replace(/\/worker_portfolio_ui\.js(?:\?v=\d+)?/g,'/worker_portfolio_ui.js?v=1');
  fs.writeFileSync(indexTarget,html);
}
// Datos DEMO adicionales para que el panel administrativo tenga usuarios y profesionales visibles.
require('./demo_admin_seed');
// Componer denuncias/fotos/evidencias/admin/verificación antes de cargar el servidor real.
require('./reports_bootstrap');
require('./request_target_bootstrap');
// El seed financiero debe ejecutarse después de los bootstraps que crean/alteran
// tablas de administración (suscripciones, banco y verificación).
require('./demo_runtime_seed');
// Compatibilidad de los datos DEMO con el flujo E2E, sin alterar las reglas reales.
require('./demo_compat_fix');
// Portafolio real: agrega la columna de imagen y reemplaza el endpoint antiguo por uno que acepta fotos.
require('./portfolio_runtime_fix');
require('./server');

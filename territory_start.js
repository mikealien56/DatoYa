// DatoYa territory bootstrap / static server
const fs=require('fs'); const path=require('path'); const ROOT=__dirname; const publicDir=path.join(ROOT,'public'); fs.mkdirSync(publicDir,{recursive:true});
require('./app_runtime_fix');
require('./worker_demo_badge_runtime_fix');
require('./backend_runtime_fix');
for(const file of ['index.html','datoya-logo.svg','app.js','frontend_globals_bridge.js','chat_ui_fix.js','notifications_ui_fix.js','home_request_fix.js','worker_own_profile_ui.js','nearby_ui.js','search_ui_fix.js','favorites_ui.js','styles.css','role_ui_fix.js','admin_v2_ui.js','admin_core_ui_fix.js','admin_operations_ui.js','admin_v3_fix.js','worker_v2_ui.js','worker_profile_fix.js','worker_portfolio_ui.js','worker_finance_ui.js','request_photos_ui.js','protection_ui.js','gps_ui.js','workflow_v2_ui.js','gps_map_ui.js','gps_map_ui_v2.js','evidence_ui.js','review_ui.js','reports_ui.js','verification_admin_ui.js','verification_worker_ui.js','request_target_ui.js','direct_worker_category_fix.js','job_finish_guard_ui.js','request_detail_ui_fix.js']){const source=path.join(ROOT,file),target=path.join(publicDir,file);if(fs.existsSync(source))fs.copyFileSync(source,target)}
const indexTarget=path.join(publicDir,'index.html');
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/request_photos_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/request_photos_ui.js"></script>\n</body>'));}
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/evidence_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/evidence_ui.js?v=2"></script>\n</body>'));}
if(fs.existsSync(indexTarget)){
  let html=fs.readFileSync(indexTarget,'utf8');
  if(!html.includes('/chat_ui_fix.js')) html=html.replace('</body>','<script src="/chat_ui_fix.js?v=1"></script>\n</body>'); else html=html.replace(/\/chat_ui_fix\.js(?:\?v=\d+)?/g,'/chat_ui_fix.js?v=1');
  if(!html.includes('/notifications_ui_fix.js')) html=html.replace('</body>','<script src="/notifications_ui_fix.js?v=1"></script>\n</body>'); else html=html.replace(/\/notifications_ui_fix\.js(?:\?v=\d+)?/g,'/notifications_ui_fix.js?v=1');
  if(!html.includes('/nearby_ui.js')) html=html.replace('</body>','<script src="/nearby_ui.js?v=4"></script>\n</body>'); else html=html.replace(/\/nearby_ui\.js(?:\?v=\d+)?/g,'/nearby_ui.js?v=4');
  if(!html.includes('/search_ui_fix.js')) html=html.replace('</body>','<script src="/search_ui_fix.js?v=1"></script>\n</body>'); else html=html.replace(/\/search_ui_fix\.js(?:\?v=\d+)?/g,'/search_ui_fix.js?v=1');
  if(!html.includes('/verification_admin_ui.js')) html=html.replace('</body>','<script src="/verification_admin_ui.js?v=2"></script>\n</body>'); else html=html.replace(/\/verification_admin_ui\.js(?:\?v=\d+)?/g,'/verification_admin_ui.js?v=2');
  if(!html.includes('/verification_worker_ui.js')) html=html.replace('</body>','<script src="/verification_worker_ui.js?v=2"></script>\n</body>'); else html=html.replace(/\/verification_worker_ui\.js(?:\?v=\d+)?/g,'/verification_worker_ui.js?v=2');
  if(!html.includes('/request_target_ui.js')) html=html.replace('</body>','<script src="/request_target_ui.js?v=3"></script>\n</body>'); else html=html.replace(/\/request_target_ui\.js(?:\?v=\d+)?/g,'/request_target_ui.js?v=3');
  if(!html.includes('/direct_worker_category_fix.js')) html=html.replace('</body>','<script src="/direct_worker_category_fix.js?v=3"></script>\n</body>'); else html=html.replace(/\/direct_worker_category_fix\.js(?:\?v=\d+)?/g,'/direct_worker_category_fix.js?v=3');
  if(!html.includes('/admin_v2_ui.js')) html=html.replace('</body>','<script src="/admin_v2_ui.js?v=5"></script>\n</body>'); else html=html.replace(/\/admin_v2_ui\.js(?:\?v=\d+)?/g,'/admin_v2_ui.js?v=5');
  if(!html.includes('/admin_core_ui_fix.js')) html=html.replace('</body>','<script src="/admin_core_ui_fix.js?v=1"></script>\n</body>'); else html=html.replace(/\/admin_core_ui_fix\.js(?:\?v=\d+)?/g,'/admin_core_ui_fix.js?v=1');
  if(!html.includes('/admin_operations_ui.js')) html=html.replace('</body>','<script src="/admin_operations_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/admin_operations_ui\.js(?:\?v=\d+)?/g,'/admin_operations_ui.js?v=1');
  if(!html.includes('/worker_own_profile_ui.js')) html=html.replace('</body>','<script src="/worker_own_profile_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/worker_own_profile_ui\.js(?:\?v=\d+)?/g,'/worker_own_profile_ui.js?v=1');
  if(!html.includes('/admin_v3_fix.js')) html=html.replace('</body>','<script src="/admin_v3_fix.js?v=4"></script>\n</body>'); else html=html.replace(/\/admin_v3_fix\.js(?:\?v=\d+)?/g,'/admin_v3_fix.js?v=4');
  if(!html.includes('/worker_profile_fix.js')) html=html.replace('</body>','<script src="/worker_profile_fix.js?v=4"></script>\n</body>'); else html=html.replace(/\/worker_profile_fix\.js(?:\?v=\d+)?/g,'/worker_profile_fix.js?v=4');
  if(!html.includes('/worker_portfolio_ui.js')) html=html.replace('</body>','<script src="/worker_portfolio_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/worker_portfolio_ui\.js(?:\?v=\d+)?/g,'/worker_portfolio_ui.js?v=1');
  if(!html.includes('/worker_finance_ui.js')) html=html.replace('</body>','<script src="/worker_finance_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/worker_finance_ui\.js(?:\?v=\d+)?/g,'/worker_finance_ui.js?v=1');
  if(!html.includes('/favorites_ui.js')) html=html.replace('</body>','<script src="/favorites_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/favorites_ui\.js(?:\?v=\d+)?/g,'/favorites_ui.js?v=1');
  if(!html.includes('/protection_ui.js')) html=html.replace('</body>','<script src="/protection_ui.js?v=3"></script>\n</body>'); else html=html.replace(/\/protection_ui\.js(?:\?v=\d+)?/g,'/protection_ui.js?v=3');
  if(!html.includes('/gps_ui.js')) html=html.replace('</body>','<script src="/gps_ui.js?v=3"></script>\n</body>'); else html=html.replace(/\/gps_ui\.js(?:\?v=\d+)?/g,'/gps_ui.js?v=3');
  if(!html.includes('/gps_map_ui_v2.js')) html=html.replace('</body>','<script src="/gps_map_ui_v2.js?v=1"></script>\n</body>');
  if(!html.includes('/job_finish_guard_ui.js')) html=html.replace('</body>','<script src="/job_finish_guard_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/job_finish_guard_ui\.js(?:\?v=\d+)?/g,'/job_finish_guard_ui.js?v=1');
  if(!html.includes('/workflow_v2_ui.js')) html=html.replace('</body>','<script src="/workflow_v2_ui.js?v=3"></script>\n</body>'); else html=html.replace(/\/workflow_v2_ui\.js(?:\?v=\d+)?/g,'/workflow_v2_ui.js?v=3');
  if(!html.includes('/review_ui.js')) html=html.replace('</body>','<script src="/review_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/review_ui\.js(?:\?v=\d+)?/g,'/review_ui.js?v=1');
  if(!html.includes('/reports_ui.js')) html=html.replace('</body>','<script src="/reports_ui.js?v=1"></script>\n</body>'); else html=html.replace(/\/reports_ui\.js(?:\?v=\d+)?/g,'/reports_ui.js?v=1');
  // Debe quedar al final: reemplaza routes.solicitud después de los wrappers legacy de fotos/target.
  if(!html.includes('/request_detail_ui_fix.js')) html=html.replace('</body>','<script src="/request_detail_ui_fix.js?v=1"></script>\n</body>'); else html=html.replace(/\/request_detail_ui_fix\.js(?:\?v=\d+)?/g,'/request_detail_ui_fix.js?v=1');
  fs.writeFileSync(indexTarget,html);
}
require('./demo_admin_seed');
require('./job_events_schema');
require('./evidence_schema');
require('./reports_bootstrap');
require('./request_target_bootstrap');
require('./territory_seed');
require('./worker_category_repair');
require('./demo_runtime_seed');
require('./demo_compat_fix');
require('./gps_syntax_fix');
require('./gps_schema');
require('./nearby_location_schema');
require('./gps_bootstrap');
require('./gps_distance_fix');
require('./nearby_workers_bootstrap');
require('./protection_schema');
require('./protection_bootstrap');
require('./protection_flow_guard');
require('./protection_complete_fix');
require('./verification_bootstrap');
require('./verification_review_bootstrap');
require('./chat_workflow_bootstrap');
require('./workflow_guard_bootstrap');
require('./portfolio_runtime_fix');
// Composición administrativa V2: monta las rutas que alimentan todas las pestañas del panel.
require('./admin_v2_bootstrap');
require('./admin_operations_bootstrap');
require('./admin_case_bootstrap');
// Este bootstrap solo intercepta la lectura final de server.js; debe quedar inmediatamente antes del servidor.
require('./review_status_bootstrap');
require('./server');

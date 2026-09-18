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
  for(const name of ['chat_ui_fix','home_request_fix','worker_own_profile_ui','nearby_ui','search_ui_fix','favorites_ui','role_ui_fix','admin_v2_ui','admin_core_ui_fix','admin_operations_ui','admin_v3_fix','worker_v2_ui','worker_profile_fix','worker_portfolio_ui','worker_finance_ui','request_photos_ui','protection_ui','gps_ui','workflow_v2_ui','gps_map_ui','gps_map_ui_v2','evidence_ui','review_ui','reports_ui','verification_admin_ui','verification_worker_ui','request_target_ui','direct_worker_category_fix','request_wizard_ui','job_finish_guard_ui','request_detail_ui_fix','job_detail_ui','job_flow_ui_bridge','worker_profile_polish_ui','worker_specialties_ui','worker_portfolio_ui','worker_onboarding_ui','professional_account_hub_ui','onboarding_flow_ui','admin_disputes_ui']){
    const re=new RegExp('<script[^>]+src="\\/'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.js[^\"]*"[^>]*><\\/script>\\s*','g');
    html=html.replace(re,'');
  }
  html=html.replace('</body>','<script src="/marketplace_legacy_route_guard.js?v=20260917-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}

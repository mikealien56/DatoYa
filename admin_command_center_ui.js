// DatoYa 2.0 — Centro de operaciones administrativo.
(function(){
 if(typeof routes==='undefined'||!routes.admin)return;
 const previous=routes.admin;
 const safe=async u=>{try{return await api(u)}catch(_){return {}}};
 const statusName=s=>({TRABAJADOR_SELECCIONADO:'Profesional seleccionado',CONFIRMADO:'Confirmado',EN_PROCESO:'En proceso',FINALIZADO:'Finalizado',CANCELADO:'Cancelado',DISPUTA:'En disputa'}[s]||String(s||'').replaceAll('_',' '));
 routes.admin=async function(tab='dashboard'){
  tab=tab||'dashboard';
  if(tab!=='dashboard'&&tab!=='resumen')return previous.apply(this,arguments);
  if(!ME||ME.role!=='admin')return previous.apply(this,arguments);
  const [jd,vd,rd,dd,sd]=await Promise.all([safe('/admin/jobs'),safe('/admin/verification-requests'),safe('/admin/reports'),safe('/admin/disputes'),safe('/admin/subscriptions')]);
  const jobs=jd.jobs||[],ver=vd.requests||[],reports=rd.reports||[],disputes=dd.disputes||[],subs=sd.subscriptions||[];
  const active=jobs.filter(j=>!['FINALIZADO','CANCELADO'].includes(j.status));
  const pendingVer=ver.filter(x=>x.status==='pendiente');
  const pendingReports=reports.filter(x=>x.status==='pendiente');
  const openDisputes=disputes.filter(x=>!['resuelta','cerrada','RESUELTA','CERRADA'].includes(String(x.status||'')));
  const activePro=subs.filter(x=>x.status==='activa');
  const recent=[...jobs].sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at))).slice(0,5);
  const nav=['#/admin/trabajos|🧾 Trabajos','#/admin/usuarios|👥 Usuarios','#/admin/trabajadores|🔧 Profesionales','#/admin/verificaciones|🪪 Verificaciones','#/admin/reclamos|⚑ Reclamos','#/admin/disputas|⚖️ Disputas','#/admin/suscripciones|⭐ PRO','#/admin/regalar-pro|🎁 Regalar PRO','#/admin/ganancias|💰 Ganancias','#/admin/retiros|💸 Retiros','#/admin/banco|🏦 Banco','#/admin/mensajes|💬 Mensajes','#/admin/categorias|🧰 Categorías','#/admin/auditoria|🕘 Auditoría','#/admin/configuracion|⚙️ Configuración'];
  view.innerHTML='<h2 class="section-title" style="margin-top:0">🛡️ Centro de operaciones</h2><p class="small muted">Lo que necesita atención y el estado general de DatoYa en una sola vista.</p>'+
   '<div class="admin-grid" style="margin-bottom:14px"><div class="stat-card"><b>'+active.length+'</b><span>Trabajos activos</span></div><div class="stat-card"><b>'+openDisputes.length+'</b><span>Disputas abiertas</span></div><div class="stat-card"><b>'+pendingVer.length+'</b><span>Verificaciones pendientes</span></div><div class="stat-card"><b>'+activePro.length+'</b><span>PRO activos</span></div></div>'+
   '<div class="card"><h3 style="margin-top:0">⚠️ Requiere atención</h3><div style="display:grid;gap:8px">'+
    '<a class="btn '+(openDisputes.length?'btn-primary':'btn-outline')+' btn-block" href="#/admin/disputas">⚖️ '+openDisputes.length+' disputa(s) abierta(s)</a>'+
    '<a class="btn '+(pendingVer.length?'btn-primary':'btn-outline')+' btn-block" href="#/admin/verificaciones">🪪 '+pendingVer.length+' verificación(es) pendiente(s)</a>'+
    '<a class="btn '+(pendingReports.length?'btn-primary':'btn-outline')+' btn-block" href="#/admin/reclamos">⚑ '+pendingReports.length+' reclamo(s) pendiente(s)</a></div></div>'+
   '<div class="card"><h3 style="margin-top:0">Gestión</h3><div class="row" style="gap:7px;flex-wrap:wrap">'+nav.map(x=>{const [href,label]=x.split('|');return '<a class="btn btn-outline btn-sm" href="'+href+'">'+label+'</a>';}).join('')+'</div></div>'+
   '<h3 class="section-title">Actividad reciente</h3>'+(recent.length?recent.map(j=>'<div class="card" style="padding:12px"><div class="row between"><div><b>'+esc(j.title||('Trabajo #'+j.id))+'</b><div class="small muted">#'+j.id+' · '+esc(j.client_name||'Cliente')+' ↔ '+esc(j.worker_name||'Profesional')+'</div></div><span class="status-tag">'+esc(statusName(j.status))+'</span></div></div>').join(''):'<div class="empty">Aún no hay actividad.</div>');
 };
})();

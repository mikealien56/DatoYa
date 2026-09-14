// DatoYa 2.0 — monitor de seguridad exclusivo admin
(function(){
 if(typeof routes==='undefined'||!routes.admin)return;
 async function renderSecurity(){
  if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return;}
  let events=[];try{events=(await api('/admin/security-events')).events||[]}catch(e){view.innerHTML='<div class="empty">'+esc(e.message)+'</div>';return;}
  const high=events.filter(x=>+x.risk>=80).length,med=events.filter(x=>+x.risk>=40&&+x.risk<80).length;
  const badge=r=>r>=80?'🔴 Alto':r>=40?'🟠 Medio':'🟢 Bajo';
  view.innerHTML='<h2 class="section-title">🛡️ Seguridad</h2><div class="card"><b>Protección Chile-only</b><p class="small muted">DatoYa registra señales de riesgo sin guardar ubicación exacta. Las alertas sirven para revisión y no significan por sí solas que una persona sea fraudulenta.</p><div class="row" style="gap:8px;flex-wrap:wrap"><span class="status-tag">'+high+' altas</span><span class="status-tag">'+med+' medias</span><span class="status-tag">'+events.length+' eventos</span></div></div>'+ (events.length?events.map(x=>'<div class="card"><div class="row between"><b>'+esc(x.name||'Visitante / sin identificar')+'</b><span class="status-tag">'+badge(+x.risk)+'</span></div><div class="small">'+esc(String(x.event_type||'').replaceAll('_',' '))+'</div><div class="small muted">'+esc(x.detail||'')+(x.ip_hint?' · IP '+esc(x.ip_hint):'')+'</div><div class="small muted">'+fmtHora(x.created_at)+'</div></div>').join(''):'<div class="empty">No hay alertas de seguridad registradas.</div>');
 }
 const previous=routes.admin;
 routes.admin=async function(tab='dashboard'){
  if(tab==='seguridad')return renderSecurity();
  return previous.apply(this,arguments);
 };
})();

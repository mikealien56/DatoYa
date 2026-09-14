// DatoYa 2.0 — Panel Admin visual, ordenado y mobile-first.
(function(){
 if(typeof routes==='undefined'||!routes.admin)return;
 const previous=routes.admin;
 const safe=async u=>{try{return await api(u)}catch(_){return {}}};
 const tile=(href,icon,title,sub,bg='#f8fafc',accent='var(--azul)')=>`<a href="${href}" style="text-decoration:none;color:var(--txt);display:block;background:${bg};border:1px solid var(--borde);border-radius:16px;padding:16px;min-height:112px"><div style="font-size:26px;margin-bottom:8px">${icon}</div><b style="font-size:15px">${title}</b><div class="small muted" style="margin-top:3px">${sub}</div><div style="text-align:right;color:${accent};font-weight:900;font-size:20px">→</div></a>`;
 const section=(title,items,bar)=>`<div style="margin-top:18px"><h3 style="margin:0 0 10px;font-size:17px">${title}</h3><div style="width:42px;height:4px;background:${bar};border-radius:9px;margin:-4px 0 10px"></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${items.join('')}</div></div>`;
 routes.admin=async function(tab='dashboard'){
  tab=tab||'dashboard';
  if(tab!=='dashboard'&&tab!=='resumen')return previous.apply(this,arguments);
  if(!ME||ME.role!=='admin')return previous.apply(this,arguments);
  const [statsD,usersD,jobsD,verD,reportsD,dispD,subsD]=await Promise.all([safe('/admin/stats'),safe('/admin/users'),safe('/admin/jobs'),safe('/admin/verification-requests'),safe('/admin/reports'),safe('/admin/disputes'),safe('/admin/subscriptions')]);
  const s=statsD.stats||{},users=usersD.users||[],jobs=jobsD.jobs||[],ver=verD.requests||[],reports=reportsD.reports||[],disputes=dispD.disputes||[],subs=subsD.subscriptions||[];
  const pendingVer=ver.filter(x=>x.status==='pendiente').length;
  const pendingReports=reports.filter(x=>x.status==='pendiente').length;
  const openDisputes=disputes.filter(x=>!['resuelta','cerrada','RESUELTA','CERRADA'].includes(String(x.status||''))).length;
  const activePro=subs.filter(x=>x.status==='activa').length;
  const recentUsers=[...users].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,4);
  const now=new Date();
  const dateTxt=now.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  const firstName=esc((ME.name||'Admin').split(' ')[0]);
  view.innerHTML=`
   <div style="background:linear-gradient(135deg,#eef5ff,#f8fbff);border:1px solid #cfe0ff;border-radius:18px;padding:18px;margin-bottom:14px">
    <div class="row between" style="align-items:center;gap:12px"><div><div class="small muted">Panel Admin</div><h2 style="margin:2px 0 5px">Bienvenido, ${firstName} 👋</h2><p class="small muted" style="margin:0">Gestiona usuarios, trabajos, pagos y el funcionamiento de DatoYa.</p></div><div style="text-align:right;min-width:105px"><div style="font-size:22px">🛡️</div><div class="small muted">${esc(dateTxt)}</div></div></div>
   </div>
   <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px">
    <a href="#/admin/usuarios" class="card" style="margin:0;padding:15px;text-decoration:none;color:var(--txt);background:#eef5ff"><div style="font-size:23px">👥</div><b style="font-size:22px">${Number(s.users||users.length||0)}</b><div class="small">Usuarios</div><div class="small" style="color:var(--azul);font-weight:700;margin-top:4px">Ver todos →</div></a>
    <a href="#/admin/trabajadores" class="card" style="margin:0;padding:15px;text-decoration:none;color:var(--txt);background:#effcf5"><div style="font-size:23px">🧰</div><b style="font-size:22px">${Number(s.workers||0)}</b><div class="small">Profesionales</div><div class="small" style="color:#15803d;font-weight:700;margin-top:4px">Ver todos →</div></a>
    <a href="#/admin/trabajos" class="card" style="margin:0;padding:15px;text-decoration:none;color:var(--txt);background:#fff8e8"><div style="font-size:23px">📋</div><b style="font-size:22px">${jobs.length}</b><div class="small">Trabajos</div><div class="small" style="color:#d97706;font-weight:700;margin-top:4px">Ver todos →</div></a>
    <a href="#/admin/disputas" class="card" style="margin:0;padding:15px;text-decoration:none;color:var(--txt);background:#fff1f2"><div style="font-size:23px">⚠️</div><b style="font-size:22px">${openDisputes}</b><div class="small">Disputas</div><div class="small" style="color:#dc2626;font-weight:700;margin-top:4px">Ver todas →</div></a>
   </div>
   ${section('Gestión principal',[
    tile('#/admin/usuarios','👥','Usuarios','Clientes y profesionales','#eef5ff'),
    tile('#/admin/trabajos','📋','Trabajos','Servicios y estados','#effcf5','#15803d'),
    tile('#/admin/reclamos','🚩','Reclamos',pendingReports+' pendiente(s)','#fff8e8','#d97706'),
    tile('#/admin/disputas','⚖️','Disputas',openDisputes+' abierta(s)','#fff1f2','#dc2626')], '#2563eb')}
   ${section('Finanzas',[
    tile('#/admin/ganancias','💰','Ganancias','Comisiones y reportes','#f0fdf4','#15803d'),
    tile('#/admin/retiros','💸','Retiros','Solicitudes de retiro','#ecfdf5','#059669'),
    tile('#/admin/banco','🏦','Banco','Datos bancarios','#eff6ff','#2563eb'),
    tile('#/admin/suscripciones','⭐','Suscripciones',activePro+' PRO activo(s)','#fff8e8','#d97706')], '#16a34a')}
   ${section('Comunicación y control',[
    tile('#/admin/mensajes','💬','Mensajes','Soporte y contacto','#f5f3ff','#7c3aed'),
    tile('#/admin/verificaciones','🪪','Verificaciones',pendingVer+' pendiente(s)','#eff6ff','#2563eb'),
    tile('#/admin/categorias','🧰','Categorías','Servicios y oficios','#fff1f2','#dc2626'),
    tile('#/admin/configuracion','⚙️','Configuración','Ajustes del sistema','#f8fafc','#475569')], '#7c3aed')}
   ${section('Herramientas',[
    tile('#/admin/regalar-pro','🎁','Regalar PRO','Asignar 30 días PRO','#fff8e8','#d97706'),
    tile('#/admin/auditoria','🕘','Auditoría','Historial de acciones','#f8fafc','#475569')], '#64748b')}
   <div class="row between" style="margin:22px 0 10px"><h3 style="margin:0">👥 Usuarios recientes</h3><a class="btn btn-outline btn-sm" href="#/admin/usuarios">Ver todos</a></div>
   ${recentUsers.length?recentUsers.map(u=>`<div class="card" style="padding:14px"><div class="row between" style="align-items:flex-start;gap:10px"><div style="min-width:0"><b>${esc(u.name||'Usuario')}</b><div class="small muted" style="overflow:hidden;text-overflow:ellipsis">${esc(u.email||'')} · ${esc(u.comuna||'Sin comuna')}</div><div class="small" style="margin-top:4px">Rol: <b>${esc(u.role||'')}</b> · Alta: ${fmtHora(u.created_at)}</div></div><span class="status-tag ${Number(u.is_active)===1?'st-FINALIZADO':'st-CANCELADO'}">${Number(u.is_active)===1?'Activo':'Suspendido'}</span></div></div>`).join(''):'<div class="empty">Aún no hay usuarios recientes.</div>'}
  `;
 };
})();

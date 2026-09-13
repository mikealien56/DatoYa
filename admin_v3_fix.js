// DatoYa 2.0 — Fix incremental del panel administrativo
// No reemplaza el panel existente: completa las pestañas que estaban cayendo al controlador antiguo.
(function () {
  if (typeof routes === 'undefined' || !routes.admin) return;

  const previousAdmin = routes.admin;

  const menu = `
    <style>
      .datoya-admin-menu{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 16px}
      .datoya-admin-menu button{padding:9px 12px;border-radius:22px;border:1px solid var(--borde);background:#fff;font-weight:600;font-size:13px;white-space:nowrap;cursor:pointer}
      .datoya-admin-menu button:hover{filter:brightness(.97)}
      @media(max-width:650px){.datoya-admin-menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.datoya-admin-menu button{width:100%;font-size:12px;padding:9px 6px}}
    </style>
    <div class="datoya-admin-menu">
      <button onclick="location.hash='#/admin'">📊 Resumen</button>
      <button onclick="location.hash='#/admin/usuarios'">👥 Usuarios</button>
      <button onclick="location.hash='#/admin/trabajadores'">🔧 Profesionales</button>
      <button onclick="location.hash='#/admin/verificaciones'">🪪 Verificaciones</button>
      <button onclick="location.hash='#/admin/reclamos'">⚑ Reclamos</button>
      <button onclick="location.hash='#/admin/disputas'">⚖️ Disputas</button>
      <button onclick="location.hash='#/admin/ganancias'">💰 Ganancias</button>
      <button onclick="location.hash='#/admin/banco'">🏦 Banco</button>
      <button onclick="location.hash='#/admin/mensajes'">💬 Mensajes</button>
      <button onclick="location.hash='#/admin/suscripciones'">⭐ Suscripciones</button>
    </div>`;

  function esc2(v){ return typeof esc === 'function' ? esc(v ?? '') : String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function money(v){ return typeof fmtCLP === 'function' ? fmtCLP(v) : '$'+Number(v||0).toLocaleString('es-CL'); }
  function time(v){ return typeof fmtHora === 'function' ? fmtHora(v) : (v || '—'); }
  function shell(title,body){ view.innerHTML=`<h2 class="section-title" style="margin-top:0">🛡️ ${title}</h2>${menu}${body}`; }

  routes.admin = async function(tab='dashboard'){
    if(!ME || ME.role!=='admin'){
      view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';
      return;
    }

    try{
      if(tab==='dashboard'){
        const r=await api('/admin/stats');
        const s=r.stats||{};
        const jobs=Array.isArray(s.jobs_by_status)?s.jobs_by_status:[];
        shell('Resumen administrativo',`
          <div class="admin-grid">
            <div class="stat-card"><b>${s.users||0}</b><span>Usuarios</span></div>
            <div class="stat-card"><b>${s.workers||0}</b><span>Profesionales</span></div>
            <div class="stat-card"><b>${s.requests||0}</b><span>Solicitudes</span></div>
            <div class="stat-card"><b>${s.jobs_completed||0}</b><span>Trabajos finalizados</span></div>
          </div>
          <div class="card" style="margin-top:14px"><h3>📌 Estado de trabajos</h3>${jobs.map(j=>`<div class="row between small" style="padding:7px 0;border-bottom:1px solid var(--borde)"><b>${esc2(j.status)}</b><span>${j.c||0}</span></div>`).join('')||'<div class="empty">Sin datos todavía.</div>'}</div>
          <div class="lock-note" style="margin-top:12px">Panel administrativo DatoYa 2.0. Los pagos y retiros continúan en modo DEMO.</div>`);
        return;
      }

      if(tab==='usuarios'){
        const r=await api('/admin/users');
        const users=r.users||[];
        const html=users.map(u=>`<div class="card"><div class="row between"><div><b>👤 ${esc2(u.name)}</b><div class="small muted">${esc2(u.email)} · ${esc2(u.phone||'Sin teléfono')}</div></div><span class="pill">${esc2(u.role)}</span></div><div class="small muted" style="margin-top:7px">${esc2(u.comuna||'Sin comuna')} · Registro ${time(u.created_at)}</div><div class="row" style="margin-top:10px"><span class="status-tag ${u.is_active?'st-FINALIZADO':'st-CANCELADO'}">${u.is_active?'Activo':'Suspendido'}</span>${u.role!=='admin'?`<button class="btn btn-ghost btn-sm" onclick="toggleAdminUser(${u.id})">${u.is_active?'Suspender':'Activar'}</button>`:''}</div></div>`).join('')||'<div class="empty">No hay usuarios.</div>';
        shell('Usuarios',html);
        return;
      }

      if(tab==='trabajadores'){
        const r=await api('/admin/workers');
        const workers=r.workers||[];
        const html=workers.map(w=>`<div class="card"><div class="row between"><div><b>🔧 ${esc2(w.name)}</b><div class="small muted">${esc2(w.oficio||'Oficio no definido')} · ${esc2(w.email||'')}</div></div><span class="status-tag ${w.status==='disponible'?'st-FINALIZADO':'st-DISPUTA'}">${esc2(w.status||'')}</span></div><div class="small" style="margin-top:7px">${esc2(w.comuna||'Sin comuna')} · ⭐ ${Number(w.rating_avg||0).toFixed(1)} · ${w.jobs_completed||0} trabajos · ${w.verified_identity?'✓ Verificado':'Sin verificar'} ${w.is_pro?'· ⭐ PRO':''}</div><div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="toggleFeaturedWorker(${w.id})">${w.is_featured?'Quitar destacado':'⭐ Destacar'}</button></div></div>`).join('')||'<div class="empty">No hay profesionales.</div>';
        shell('Profesionales',html);
        return;
      }

      return previousAdmin(tab);
    }catch(e){
      if(typeof toast==='function') toast(e.message||'No se pudo cargar el panel administrativo','err');
      else view.innerHTML='<div class="empty">No se pudo cargar el panel administrativo.</div>';
    }
  };

  window.toggleAdminUser=async function(id){
    try{const r=await api('/admin/users/'+id+'/toggle',{method:'POST'});if(typeof toast==='function')toast(r.active?'Usuario activado':'Usuario suspendido','ok');route();}
    catch(e){if(typeof toast==='function')toast(e.message,'err');}
  };

  window.toggleFeaturedWorker=async function(id){
    try{const r=await api('/admin/workers/'+id+'/feature',{method:'POST'});if(typeof toast==='function')toast(r.featured?'Profesional destacado':'Profesional quitado de destacados','ok');route();}
    catch(e){if(typeof toast==='function')toast(e.message,'err');}
  };
})();

// DatoYa 2.0 — categorías, trabajos y auditoría administrativa.
(() => {
  const previousAdmin = routes.admin;
  const escOp = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const moneyOp = value => '$' + Number(value || 0).toLocaleString('es-CL');

  const menuItems = [
    ['#/admin','📊 Resumen'],
    ['#/admin/usuarios','👥 Usuarios'],
    ['#/admin/trabajadores','🔧 Profesionales'],
    ['#/admin/categorias','🧰 Categorías'],
    ['#/admin/trabajos','🧾 Trabajos'],
    ['#/admin/verificaciones','🪪 Verificaciones'],
    ['#/admin/reclamos','⚑ Reclamos'],
    ['#/admin/disputas','⚖️ Disputas'],
    ['#/admin/auditoria','🕘 Auditoría'],
    ['#/admin/ganancias','💰 Ganancias'],
    ['#/admin/retiros','💸 Retiros'],
    ['#/admin/banco','🏦 Banco'],
    ['#/admin/mensajes','💬 Mensajes'],
    ['#/admin/suscripciones','⭐ Suscripciones'],
    ['#/admin/configuracion','⚙️ Configuración']
  ];

  function menuHtml() {
    return `<div class="tabs admin-tabs" style="display:flex;flex-wrap:wrap;overflow:visible;gap:6px">${menuItems.map(([href,label])=>`<button onclick="location.hash='${href}'">${label}</button>`).join('')}</div>`;
  }

  function shell(title, body) {
    view.innerHTML = `<h2 class="section-title" style="margin-top:0">🛡️ ${title}</h2>${menuHtml()}${body}`;
  }

  function completeExistingMenu() {
    const menu = view?.querySelector?.('.admin-tabs');
    if (!menu) return;
    const existing = new Set([...menu.querySelectorAll('button')].map(b => String(b.getAttribute('onclick') || '')));
    for (const [href,label] of menuItems) {
      if ([...existing].some(x => x.includes(href))) continue;
      const button=document.createElement('button');
      button.textContent=label;
      button.onclick=()=>{ location.hash=href; };
      menu.appendChild(button);
    }
  }

  function statusClass(status) {
    if (status === 'FINALIZADO') return 'st-FINALIZADO';
    if (status === 'CANCELADO') return 'st-CANCELADO';
    if (status === 'DISPUTA') return 'st-DISPUTA';
    return '';
  }

  function safeMetadata(raw) {
    if (!raw) return '';
    try {
      const obj=JSON.parse(raw);
      // Evitar que una vista de auditoría exponga accidentalmente datos GPS precisos.
      if (obj && typeof obj === 'object') {
        delete obj.lat; delete obj.lng; delete obj.latitude; delete obj.longitude;
      }
      const text=JSON.stringify(obj);
      return text.length > 220 ? text.slice(0,217)+'…' : text;
    } catch (_) {
      const text=String(raw);
      return text.length > 220 ? text.slice(0,217)+'…' : text;
    }
  }

  routes.admin = async function(tab='dashboard') {
    tab = tab || 'dashboard';
    if (!ME || ME.role !== 'admin') return previousAdmin(tab);

    try {
      if (tab === 'categorias') {
        const data=await api('/admin/categories');
        const categories=data.categories || [];
        shell('Categorías', `
          <div class="card">
            <h3 style="margin-top:0">Agregar categoría</h3>
            <form onsubmit="createAdminCategory(event)" class="row wrap" style="align-items:flex-end">
              <div class="field" style="min-width:90px;max-width:120px"><label>Ícono</label><input name="icon" maxlength="8" value="🧰"></div>
              <div class="field" style="flex:1;min-width:220px"><label>Nombre</label><input name="name" maxlength="80" placeholder="Ej: Reparación de electrodomésticos" required></div>
              <button class="btn btn-primary" style="margin-bottom:16px">Agregar</button>
            </form>
          </div>
          ${categories.map(c=>`<div class="card"><div class="row between"><div><b style="font-size:17px">${escOp(c.icon || '🧰')} ${escOp(c.name)}</b><div class="small muted">Categoría #${Number(c.id)}</div></div><span class="status-tag ${Number(c.active)===1?'st-FINALIZADO':'st-CANCELADO'}">${Number(c.active)===1?'Activa':'Inactiva'}</span></div><button class="btn ${Number(c.active)===1?'btn-danger':'btn-green'} btn-sm" style="margin-top:10px" onclick="toggleAdminCategory(${Number(c.id)})">${Number(c.active)===1?'Desactivar':'Activar'}</button></div>`).join('') || '<div class="empty">No hay categorías.</div>'}`);
        return;
      }

      if (tab === 'trabajos') {
        const data=await api('/admin/jobs');
        const jobs=data.jobs || [];
        shell('Trabajos', `
          <div class="admin-grid" style="margin-bottom:12px">
            <div class="stat-card"><b>${jobs.length}</b><span>Total visible</span></div>
            <div class="stat-card"><b>${jobs.filter(j=>j.status==='FINALIZADO').length}</b><span>Finalizados</span></div>
            <div class="stat-card"><b>${jobs.filter(j=>j.status==='DISPUTA').length}</b><span>En disputa</span></div>
            <div class="stat-card"><b>${jobs.filter(j=>!['FINALIZADO','CANCELADO'].includes(j.status)).length}</b><span>Activos</span></div>
          </div>
          ${jobs.map(j=>`<div class="card"><div class="row between" style="align-items:flex-start"><div><b>Trabajo #${Number(j.id)} · ${escOp(j.title || 'Servicio')}</b><div class="small muted">${escOp(j.comuna || 'Sin comuna')} · ${fmtHora(j.updated_at || j.created_at)}</div></div><span class="status-tag ${statusClass(j.status)}">${escOp(j.status)}</span></div><div class="row wrap" style="margin-top:10px;gap:12px"><span>👤 ${escOp(j.client_name)}</span><span>🔧 ${escOp(j.worker_name)}</span><span>💵 <b>${moneyOp(j.price)}</b></span><span>Comisión ${Number(j.commission_pct || 0)}% · ${moneyOp(j.commission_amount)}</span>${j.protection_status?`<span>🛡️ ${escOp(j.protection_status)}</span>`:''}</div></div>`).join('') || '<div class="empty">Todavía no hay trabajos.</div>'}`);
        return;
      }

      if (tab === 'auditoria') {
        const data=await api('/admin/audit');
        const entries=[];
        for (const h of (data.history || [])) entries.push({kind:'Estado',job_id:h.job_id,type:h.status,actor:h.actor_name || h.actor_role || 'Sistema',created_at:h.created_at,metadata:''});
        for (const e of (data.events || [])) entries.push({kind:'Evento',job_id:e.job_id,type:e.event_type,actor:e.actor_name || e.actor_role || 'Sistema',created_at:e.created_at,metadata:safeMetadata(e.metadata)});
        entries.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
        shell('Auditoría de trabajos', `
          <div class="lock-note">🕘 Registro administrativo de cambios y eventos. La vista elimina coordenadas GPS precisas de los metadatos mostrados.</div>
          ${entries.slice(0,250).map(e=>`<div class="card" style="padding:12px"><div class="row between"><div><b>${escOp(e.kind)} · Trabajo #${Number(e.job_id)}</b><div class="small muted">${escOp(e.actor)} · ${fmtHora(e.created_at)}</div></div><span class="status-tag">${escOp(e.type)}</span></div>${e.metadata?`<div class="small" style="margin-top:8px;word-break:break-word">${escOp(e.metadata)}</div>`:''}</div>`).join('') || '<div class="empty">Todavía no hay eventos de auditoría.</div>'}`);
        return;
      }

      await previousAdmin(tab);
      completeExistingMenu();
    } catch (e) {
      toast(e.message || 'No se pudo cargar esta sección administrativa', 'err');
    }
  };

  window.createAdminCategory = async function(e) {
    e.preventDefault();
    const f=e.target;
    const name=f.name.value.trim();
    if (!name) return;
    try {
      await api('/admin/categories',{method:'POST',body:{name,icon:f.icon.value.trim() || '🧰'}});
      toast('Categoría agregada.','ok');
      route();
    } catch (x) { toast(x.message,'err'); }
  };

  window.toggleAdminCategory = async function(id) {
    try {
      await api('/admin/categories/'+id+'/toggle',{method:'POST'});
      toast('Estado de categoría actualizado.','ok');
      route();
    } catch (x) { toast(x.message,'err'); }
  };
})();

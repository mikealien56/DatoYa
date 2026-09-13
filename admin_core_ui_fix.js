// DatoYa 2.0 — pantallas administrativas que antes existían solo como API.
(() => {
  const previousAdmin = routes.admin;

  const escAdmin = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const moneyAdmin = value => '$' + Number(value || 0).toLocaleString('es-CL');

  const fullMenu = `
    <div class="tabs admin-tabs" style="display:flex;flex-wrap:wrap;overflow:visible;gap:6px">
      <button onclick="location.hash='#/admin'">📊 Resumen</button>
      <button onclick="location.hash='#/admin/usuarios'">👥 Usuarios</button>
      <button onclick="location.hash='#/admin/trabajadores'">🔧 Profesionales</button>
      <button onclick="location.hash='#/admin/verificaciones'">🪪 Verificaciones</button>
      <button onclick="location.hash='#/admin/reclamos'">⚑ Reclamos</button>
      <button onclick="location.hash='#/admin/disputas'">⚖️ Disputas</button>
      <button onclick="location.hash='#/admin/ganancias'">💰 Ganancias</button>
      <button onclick="location.hash='#/admin/retiros'">💸 Retiros</button>
      <button onclick="location.hash='#/admin/banco'">🏦 Banco</button>
      <button onclick="location.hash='#/admin/mensajes'">💬 Mensajes</button>
      <button onclick="location.hash='#/admin/suscripciones'">⭐ Suscripciones</button>
      <button onclick="location.hash='#/admin/configuracion'">⚙️ Configuración</button>
    </div>`;

  function shell(title, body) {
    view.innerHTML = `<h2 class="section-title" style="margin-top:0">🛡️ ${title}</h2>${fullMenu}${body}`;
  }

  function ensureExtras() {
    const menu = view?.querySelector?.('.admin-tabs');
    if (!menu) return;
    if (!menu.querySelector('[data-admin-extra="retiros"]')) {
      menu.insertAdjacentHTML('beforeend', `<button data-admin-extra="retiros" onclick="location.hash='#/admin/retiros'">💸 Retiros</button>`);
    }
    if (!menu.querySelector('[data-admin-extra="configuracion"]')) {
      menu.insertAdjacentHTML('beforeend', `<button data-admin-extra="configuracion" onclick="location.hash='#/admin/configuracion'">⚙️ Configuración</button>`);
    }
  }

  function stat(label, value) {
    return `<div class="stat-card"><b>${escAdmin(value)}</b><span>${escAdmin(label)}</span></div>`;
  }

  routes.admin = async function(tab = 'dashboard') {
    tab = tab || 'dashboard';
    if (!ME || ME.role !== 'admin') return previousAdmin(tab);

    try {
      if (tab === 'dashboard') {
        const [{stats:s}, cfg] = await Promise.all([
          api('/admin/stats'),
          api('/admin/settings').catch(() => ({settings:{}}))
        ]);
        const jobs = Array.isArray(s.jobs_by_status) ? s.jobs_by_status : [];
        const top = Array.isArray(s.top_categories) ? s.top_categories : [];
        shell('Resumen administrativo', `
          <div class="admin-grid">
            ${stat('Usuarios', s.users || 0)}
            ${stat('Profesionales', s.workers || 0)}
            ${stat('Solicitudes', s.requests || 0)}
            ${stat('Trabajos finalizados', s.jobs_completed || 0)}
          </div>
          <div class="card" style="margin-top:14px">
            <div class="row between"><h3 style="margin:0">Estado de trabajos</h3><span class="pill">Comisión ${escAdmin(cfg.settings?.commission_pct ?? 10)}%</span></div>
            <div class="row wrap" style="gap:8px;margin-top:12px">${jobs.length ? jobs.map(j => `<span class="status-tag">${escAdmin(j.status)} · ${Number(j.c || 0)}</span>`).join('') : '<span class="small muted">Todavía no hay trabajos.</span>'}</div>
          </div>
          <div class="card">
            <h3 style="margin-top:0">Categorías más solicitadas</h3>
            ${top.length ? top.map(c => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--borde)"><span>${escAdmin(c.icon || '🛠️')} ${escAdmin(c.name)}</span><b>${Number(c.n || 0)}</b></div>`).join('') : '<div class="small muted">Sin datos todavía.</div>'}
          </div>`);
        return;
      }

      if (tab === 'usuarios') {
        const data = await api('/admin/users');
        const users = data.users || [];
        shell('Usuarios', `${users.map(u => {
          const active = Number(u.is_active) === 1;
          return `<div class="card"><div class="row between" style="align-items:flex-start"><div><b>${escAdmin(u.name)}</b> ${u.is_demo ? '<span class="demo-tag">DEMO</span>' : ''}<div class="small muted">${escAdmin(u.email)} · ${escAdmin(u.comuna || 'Sin comuna')}</div><div class="small" style="margin-top:4px">Rol: <b>${escAdmin(u.role)}</b> · Alta: ${fmtHora(u.created_at)}</div></div><span class="status-tag ${active ? 'st-FINALIZADO' : 'st-CANCELADO'}">${active ? 'Activo' : 'Suspendido'}</span></div>${u.role !== 'admin' ? `<button class="btn ${active ? 'btn-danger' : 'btn-green'} btn-sm" style="margin-top:10px" onclick="toggleAdminUser(${Number(u.id)})">${active ? 'Suspender cuenta' : 'Reactivar cuenta'}</button>` : '<div class="small muted" style="margin-top:10px">La cuenta administradora no se puede suspender desde aquí.</div>'}</div>`;
        }).join('') || '<div class="empty">No hay usuarios.</div>'}`);
        return;
      }

      if (tab === 'trabajadores') {
        const data = await api('/admin/workers');
        const workers = data.workers || [];
        shell('Profesionales', `${workers.map(w => `<div class="card"><div class="row between" style="align-items:flex-start"><div><b>🔧 ${escAdmin(w.name || 'Profesional')}</b><div class="small muted">${escAdmin(w.oficio || 'Oficio no definido')} · ${escAdmin(w.comuna || 'Sin comuna')}</div><div class="small" style="margin-top:4px">⭐ ${Number(w.rating_avg || 0).toFixed(1)} · ${Number(w.jobs_completed || 0)} trabajos · ${w.verified_identity ? '✓ Verificado' : 'Sin verificar'}</div></div><div class="row wrap" style="justify-content:flex-end"><span class="pill">${escAdmin(w.status || '—')}</span>${w.is_pro ? '<span class="pill pill-pro">PRO</span>' : ''}${w.is_featured ? '<span class="pill">🏆 Destacado</span>' : ''}</div></div><div class="row wrap" style="margin-top:10px"><a class="btn btn-outline btn-sm" href="#/trabajador/${Number(w.id)}">Ver perfil</a><button class="btn btn-primary btn-sm" onclick="toggleAdminFeatured(${Number(w.id)})">${w.is_featured ? 'Quitar destacado' : 'Marcar destacado'}</button></div></div>`).join('') || '<div class="empty">No hay profesionales.</div>'}`);
        return;
      }

      if (tab === 'retiros') {
        const data = await api('/admin/payouts');
        const payouts = data.payouts || [];
        const pending = payouts.filter(p => p.status === 'pendiente');
        shell('Retiros de profesionales', `
          <div class="lock-note">💸 MODO DEMO: estas acciones actualizan el estado del retiro, pero no realizan una transferencia bancaria real.</div>
          <div class="admin-grid" style="margin:12px 0">${stat('Pendientes', pending.length)}${stat('Total solicitudes', payouts.length)}${stat('Monto pendiente', moneyAdmin(pending.reduce((s,p)=>s+Number(p.amount||0),0)))}</div>
          ${payouts.map(p => `<div class="card"><div class="row between"><div><b>${escAdmin(p.name || 'Profesional')}</b><div class="small muted">Retiro #${Number(p.id)} · ${fmtHora(p.created_at)}</div></div><span class="status-tag ${p.status === 'pagado' ? 'st-FINALIZADO' : p.status === 'rechazado' ? 'st-CANCELADO' : 'st-DISPUTA'}">${escAdmin(p.status)}</span></div><div style="font-size:22px;font-weight:800;margin-top:10px">${moneyAdmin(p.amount)}</div>${p.status === 'pendiente' ? `<div class="row wrap" style="margin-top:10px"><button class="btn btn-green btn-sm" onclick="resolveAdminPayout(${Number(p.id)},'pagar')">Marcar pagado</button><button class="btn btn-danger btn-sm" onclick="resolveAdminPayout(${Number(p.id)},'rechazar')">Rechazar</button></div>` : ''}</div>`).join('') || '<div class="empty">No hay solicitudes de retiro.</div>'}`);
        return;
      }

      if (tab === 'configuracion') {
        const data = await api('/admin/settings');
        const s = data.settings || {};
        shell('Configuración', `
          <div class="card" style="max-width:680px">
            <h3 style="margin-top:0">Tarifas y comisión</h3>
            <form onsubmit="saveAdminSettings(event)">
              <div class="field"><label>Comisión DatoYa (%)</label><input name="commission_pct" type="number" min="0" max="50" step="0.1" value="${escAdmin(s.commission_pct ?? 10)}" required><div class="small muted">Se aplica a los trabajos procesados por DatoYa.</div></div>
              <div class="field"><label>Precio DatoYa PRO mensual</label><input name="pro_price" type="number" min="0" step="100" value="${escAdmin(s.pro_price ?? 9990)}" required></div>
              <div class="field"><label>Precio de destacado</label><input name="featured_price" type="number" min="0" step="100" value="${escAdmin(s.featured_price ?? 4990)}" required></div>
              <button class="btn btn-primary">Guardar configuración</button>
            </form>
          </div>`);
        return;
      }

      await previousAdmin(tab);
      ensureExtras();
    } catch (e) {
      toast(e.message || 'No se pudo cargar el panel administrativo', 'err');
    }
  };

  window.toggleAdminUser = async function(id) {
    if (!confirm('¿Confirmas cambiar el estado de esta cuenta?')) return;
    try { await api('/admin/users/' + id + '/toggle', {method:'POST'}); toast('Estado de usuario actualizado.', 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.toggleAdminFeatured = async function(id) {
    try { await api('/admin/workers/' + id + '/feature', {method:'POST'}); toast('Destacado actualizado.', 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.resolveAdminPayout = async function(id, action) {
    if (!confirm(action === 'pagar' ? '¿Marcar este retiro DEMO como pagado?' : '¿Rechazar este retiro?')) return;
    try { await api('/admin/payouts/' + id, {method:'POST', body:{action}}); toast('Retiro actualizado.', 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.saveAdminSettings = async function(e) {
    e.preventDefault();
    const f=e.target;
    try {
      await api('/admin/settings', {method:'POST', body:{commission_pct:Number(f.commission_pct.value),pro_price:Number(f.pro_price.value),featured_price:Number(f.featured_price.value)}});
      toast('Configuración guardada.', 'ok');
      route();
    } catch (x) { toast(x.message, 'err'); }
  };
})();

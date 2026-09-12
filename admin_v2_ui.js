// DatoYa 2.0 — UI Admin / PRO
(function () {
  const originalAdmin = routes.admin;
  const originalPro = routes.pro;

  const adminMenu = `
    <div class="tabs">
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
      <button onclick="location.hash='#/admin/categorias'">📂 Categorías</button>
      <button onclick="location.hash='#/admin/config'">⚙️ Config</button>
    </div>`;

  function shell(title, body) {
    view.innerHTML = `<h2 class="section-title" style="margin-top:0">🛡️ ${title}</h2>${adminMenu}${body}`;
  }

  routes.admin = async function (tab = 'dashboard') {
    if (!ME || ME.role !== 'admin') { view.innerHTML = '<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>'; return; }
    if (!['reclamos','disputas','ganancias','banco','mensajes','suscripciones'].includes(tab)) return originalAdmin(tab);
    if (tab === 'reclamos') {
      const { reports } = await api('/admin/reports');
      shell('Reclamos y denuncias', reports.map(r => `<div class="card"><div class="row between"><b>⚑ ${esc(r.reason.replace(/_/g,' '))}</b><span class="status-tag ${r.status==='pendiente'?'st-DISPUTA':'st-FINALIZADO'}">${r.status}</span></div><div class="small muted">Ticket #${r.id} · ${esc(r.reporter)} · ${esc(r.target_type)} #${r.target_id} · ${fmtHora(r.created_at)}</div><p class="small">${esc(r.details||'Sin detalles')}</p>${r.status==='pendiente'?`<div class="row"><button class="btn btn-green btn-sm" onclick="resolveReport(${r.id},'resuelta')">Resolver</button><button class="btn btn-ghost btn-sm" onclick="resolveReport(${r.id},'descartada')">Descartar</button></div>`:''}</div>`).join('')||'<div class="empty">No hay reclamos.</div>');
    } else if (tab === 'disputas') {
      const { disputes } = await api('/admin/disputes');
      shell('Disputas de trabajos', disputes.map(d => `<div class="card"><div class="row between"><b>⚖️ Disputa #${d.id}</b><span class="status-tag st-DISPUTA">${d.status}</span></div><div class="small muted">Cliente: ${esc(d.client_name)} · Profesional: ${esc(d.worker_name)} · ${fmtCLP(d.price)}</div><div class="small muted">Creada: ${fmtHora(d.created_at)}</div><p class="small">La resolución definitiva debe conservar evidencia e historial del trabajo.</p></div>`).join('')||'<div class="empty">No hay disputas abiertas.</div>');
    } else if (tab === 'ganancias') {
      const r = await api('/admin/earnings');
      shell('Ganancias DatoYa', `<div class="admin-grid"><div class="stat-card"><b>${fmtCLP(r.gross)}</b><span>Volumen bruto</span></div><div class="stat-card"><b>${fmtCLP(r.commissions)}</b><span>Comisiones DatoYa</span></div><div class="stat-card"><b>${fmtCLP(r.workers)}</b><span>Parte profesionales</span></div><div class="stat-card"><b>${fmtCLP(r.payouts)}</b><span>Retiros pagados</span></div></div><div class="lock-note" style="margin-top:12px">MODO DEMO: estas cifras son internas de prueba. La comisión configurada actualmente es 10%.</div>`);
    } else if (tab === 'banco') {
      const r = await api('/admin/bank');
      shell('Banco y retiros', `<div class="lock-note">🏦 MODO DEMO: DatoYa no procesa dinero real todavía. Los datos bancarios reales se incorporarán mediante un proveedor seguro antes de producción.</div>${r.accounts.map(a => `<div class="card row between"><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)} · ${a.is_pro?'⭐ PRO':''} · ${a.verified_identity?'✓ Verificado':'Sin verificar'}</div></div><span class="pill">Cuenta pendiente</span></div>`).join('')||'<div class="empty">No hay profesionales.</div>'}`);
    } else if (tab === 'mensajes') {
      const { conversations } = await api('/admin/messages');
      shell('Mensajes', `<div class="lock-note">El administrador puede supervisar la existencia y actividad de conversaciones, pero no debe modificar mensajes de usuarios sin un procedimiento de soporte.</div>${conversations.map(c => `<div class="card"><div class="row between"><b>💬 ${esc(c.client_name)} ↔ ${esc(c.worker_name)}</b><span class="small muted">${fmtHora(c.last_at||c.created_at)}</span></div><div class="small muted">${c.job_id?'Trabajo #'+c.job_id:'Solicitud #'+c.request_id}</div><p class="small">${esc(c.last_msg||'Sin mensajes')}</p></div>`).join('')||'<div class="empty">No hay conversaciones.</div>'}`);
    } else if (tab === 'suscripciones') {
      const { subscriptions } = await api('/admin/subscriptions');
      shell('Suscripciones PRO', `<div class="admin-grid"><div class="stat-card"><b>${subscriptions.filter(s=>s.status==='activa').length}</b><span>Activas</span></div><div class="stat-card"><b>${subscriptions.filter(s=>s.plan==='MENSUAL'&&s.status==='activa').length}</b><span>Mensuales</span></div><div class="stat-card"><b>${subscriptions.filter(s=>s.plan==='ANUAL'&&s.status==='activa').length}</b><span>Anuales</span></div></div>${subscriptions.map(s=>`<div class="card row between"><div><b>${esc(s.name)}</b><div class="small muted">Plan ${s.plan} · inicio ${fmtHora(s.started_at)} · vence ${fmtHora(s.expires_at)}</div></div><span class="pill pill-pro">${s.status}</span></div>`).join('')||'<div class="empty">No hay suscripciones.</div>'}`);
    }
  };

  routes.pro = async function () {
    if (!ME || ME.role !== 'trabajador') return originalPro();
    const cfg = await api('/config');
    const sub = await api('/worker/subscription');
    const monthly = Number(cfg.pro_price || 9990);
    const annual = Number(cfg.pro_annual_price || Math.round(monthly * 10));
    view.innerHTML = `<div class="card" style="max-width:620px;margin:20px auto;text-align:center"><div style="font-size:44px">⭐</div><h2>DatoYa PRO</h2><p class="muted">Elige tu suscripción profesional mensual o anual.</p><div class="row wrap" style="align-items:stretch;margin-top:18px"><div class="card" style="flex:1;min-width:220px;border:2px solid var(--borde)"><h3>Mensual</h3><b style="font-size:28px">${fmtCLP(monthly)}</b><span>/mes</span><p class="small muted">Se renueva mensualmente.</p><button class="btn btn-primary btn-block" onclick="activateSubscription('MENSUAL')">${sub.subscription?.plan==='MENSUAL'?'Renovar':'Suscribirme'}</button></div><div class="card" style="flex:1;min-width:220px;border:2px solid var(--ambar)"><h3>🏆 Anual</h3><b style="font-size:28px">${fmtCLP(annual)}</b><span>/año</span><p class="small muted">Ahorro frente al pago mensual.</p><button class="btn btn-accent btn-block" onclick="activateSubscription('ANUAL')">${sub.subscription?.plan==='ANUAL'?'Renovar':'Elegir anual'}</button></div></div><div class="card" style="margin-top:16px;text-align:left"><h3>Incluye</h3><p>✓ Mayor visibilidad · ✓ insignia PRO · ✓ estadísticas · ✓ hasta 12 fotos · ✓ prioridad en solicitudes</p></div><div class="lock-note">MODO DEMO: todavía no se cobra dinero real. Antes de producción se conectará una pasarela y renovación automática segura.</div>${sub.subscription?`<p class="small muted">Tu plan actual: <b>${sub.subscription.plan}</b> · vence ${fmtHora(sub.subscription.expires_at)}</p>`:''}</div>`;
  };

  window.activateSubscription = async function(plan) {
    try { const r = await api('/worker/subscription',{method:'POST',body:{plan}}); toast(r.message,'ok'); route(); }
    catch(e){ toast(e.message,'err'); }
  };
})();

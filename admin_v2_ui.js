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
    </div>`;

  function shell(title, body) {
    view.innerHTML = `<h2 class="section-title" style="margin-top:0">🛡️ ${title}</h2>${adminMenu}${body}`;
  }

  function reportRole(role) {
    if (role === 'cliente') return '👤 Cliente';
    if (role === 'trabajador') return '🔧 Profesional';
    if (role === 'admin') return '🛡️ Admin';
    return esc(role || '—');
  }

  function reportCard(r) {
    const statusClass = r.status === 'pendiente' ? 'st-DISPUTA' : r.status === 'resuelta' ? 'st-FINALIZADO' : 'st-CANCELADO';
    let related = '';
    if (r.job) {
      related = `<div class="small muted" style="margin-top:5px"><b>Trabajo #${r.job.id}</b> · ${esc(r.job.request_title || 'Servicio')} · ${esc(r.job.comuna || 'Comuna no indicada')} · ${fmtCLP(r.job.price)}</div>`;
    } else if (r.request) {
      related = `<div class="small muted" style="margin-top:5px"><b>Solicitud #${r.request.id}</b> · ${esc(r.request.title || 'Servicio')} · ${esc(r.request.comuna || 'Comuna no indicada')}</div>`;
    }
    const actions = r.status === 'pendiente'
      ? `<button class="btn btn-green btn-sm" onclick="resolveReport(${r.id},'resuelta')">Resolver</button><button class="btn btn-ghost btn-sm" onclick="resolveReport(${r.id},'descartada')">Descartar</button>`
      : '';
    return `<div class="card"><div class="row between"><b>⚑ ${esc(String(r.reason || '').replace(/_/g, ' '))}</b><span class="status-tag ${statusClass}">${esc(r.status)}</span></div><div class="admin-grid" style="margin:12px 0"><div class="stat-card"><span>Denunciante</span><b style="font-size:16px">${esc(r.reporter_name || r.reporter || '—')}</b><small>${reportRole(r.reporter_role)}</small></div><div class="stat-card"><span>Denunciado</span><b style="font-size:16px">${esc(r.target_name || 'No identificado')}</b><small>${reportRole(r.target_role)}</small></div></div><div class="small"><b>Dirección:</b> ${esc(r.direction || '—')}</div><div class="small muted">Ticket #${r.id} · ${esc(r.target_type || '')} #${r.target_id || ''} · ${fmtHora(r.created_at)}</div>${related}<p class="small">${esc(r.details || 'Sin detalles')}</p><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openReportCase(${r.id})">📁 Ver expediente</button>${actions}</div></div>`;
  }

  routes.admin = async function (tab = 'dashboard') {
    if (!ME || ME.role !== 'admin') {
      view.innerHTML = '<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';
      return;
    }
    const supported = ['reclamos', 'disputas', 'ganancias', 'banco', 'mensajes', 'suscripciones', 'verificaciones'];
    if (!supported.includes(tab)) return originalAdmin(tab);

    try {
      if (tab === 'verificaciones') {
        const data = await api('/admin/verification-requests');
        const requests = data.requests || [];
        const html = requests.map(v => {
          const statusClass = v.status === 'pendiente' ? 'st-DISPUTA' : v.status === 'aprobada' ? 'st-FINALIZADO' : 'st-CANCELADO';
          const actions = v.status === 'pendiente' ? `<div class="row" style="margin-top:12px"><button class="btn btn-green btn-sm" onclick="resolveAdminVerification(${v.id},'aprobar')">✓ Aprobar verificación</button><button class="btn btn-danger btn-sm" onclick="resolveAdminVerification(${v.id},'rechazar')">Rechazar</button></div>` : '';
          return `<div class="card"><div class="row between"><div><b>🪪 ${esc(v.name)}</b><div class="small muted">${esc(v.oficio)} · ${esc(v.email)}</div></div><span class="status-tag ${statusClass}">${esc(v.status)}</span></div><div class="small" style="margin-top:10px"><b>Ticket:</b> ${esc(v.ticket || ('VER-' + v.id))}</div><div class="small"><b>Documento:</b> ${esc(v.document_type || v.type || 'No indicado')}</div><div class="small"><b>Referencia:</b> ${esc(v.document_reference || 'No indicada')}</div><div class="small muted" style="margin-top:6px">Solicitud #${v.id} · ${fmtHora(v.created_at)}</div>${actions}</div>`;
        }).join('') || '<div class="empty"><b>✓</b>No hay solicitudes de verificación.</div>';
        shell('Verificaciones profesionales', `<div class="lock-note">🪪 En esta versión DEMO no se almacenan documentos de identidad reales.</div>${html}`);
        return;
      }

      if (tab === 'reclamos') {
        const data = await api('/admin/reports');
        const reports = data.reports || [];
        shell('Reclamos y denuncias', `<div class="lock-note">⚑ Cada denuncia muestra quién denuncia y a quién se denuncia. El expediente reúne solicitud, trabajo, mensajes, historial, fotos y evidencias disponibles.</div>${reports.map(reportCard).join('') || '<div class="empty">No hay reclamos.</div>'}`);
        return;
      }

      if (tab === 'disputas') {
        const data = await api('/admin/disputes');
        const disputes = data.disputes || [];
        const html = disputes.map(d => `<div class="card"><div class="row between"><b>⚖️ Disputa #${d.id}</b><span class="status-tag st-DISPUTA">${esc(d.status)}</span></div><div class="small muted">Cliente: ${esc(d.client_name)} · Profesional: ${esc(d.worker_name)} · ${fmtCLP(d.price)}</div><div class="small muted">Creada: ${fmtHora(d.created_at)}</div><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openDisputeCase(${d.id})">📁 Ver expediente</button><button class="btn btn-outline btn-sm" onclick="startDisputeReview(${d.id})">Revisar</button></div></div>`).join('') || '<div class="empty">No hay disputas abiertas.</div>';
        shell('Disputas de trabajos', html);
        return;
      }

      if (tab === 'ganancias') {
        const r = await api('/admin/earnings');
        shell('Ganancias DatoYa', `<div class="admin-grid"><div class="stat-card"><b>${fmtCLP(r.gross)}</b><span>Volumen bruto</span></div><div class="stat-card"><b>${fmtCLP(r.commissions)}</b><span>Comisiones DatoYa</span></div><div class="stat-card"><b>${fmtCLP(r.workers)}</b><span>Parte profesionales</span></div><div class="stat-card"><b>${fmtCLP(r.payouts)}</b><span>Retiros pagados</span></div></div><div class="lock-note" style="margin-top:12px">MODO DEMO: la comisión configurada actualmente es 10%.</div>`);
        return;
      }

      if (tab === 'banco') {
        const r = await api('/admin/bank');
        const html = (r.accounts || []).map(a => `<div class="card row between"><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)} · ${a.is_pro ? '⭐ PRO' : ''} · ${a.verified_identity ? '✓ Verificado' : 'Sin verificar'}${a.bank_name ? ` · ${esc(a.bank_name)} (${esc(a.account_type || '')}) •••• ${esc(a.account_last4 || '')}` : ' · Sin cuenta registrada'}</div></div><span class="pill">${a.bank_name ? 'Cuenta registrada' : 'Pendiente'}</span></div>`).join('') || '<div class="empty">No hay profesionales.</div>';
        shell('Banco y retiros', `<div class="lock-note">🏦 MODO DEMO: DatoYa todavía no procesa dinero real.</div>${html}`);
        return;
      }

      if (tab === 'mensajes') {
        const data = await api('/admin/messages');
        const html = (data.conversations || []).map(c => `<div class="card"><div class="row between"><b>💬 ${esc(c.client_name)} ↔ ${esc(c.worker_name)}</b><span class="small muted">${fmtHora(c.last_at || c.created_at)}</span></div><div class="small muted">${c.job_id ? 'Trabajo #' + c.job_id : 'Solicitud #' + (c.request_id || '—')}</div><p class="small">${esc(c.last_msg || 'Sin mensajes')}</p></div>`).join('') || '<div class="empty">No hay conversaciones.</div>';
        shell('Mensajes', `<div class="lock-note">El administrador supervisa actividad, sin modificar mensajes de usuarios.</div>${html}`);
        return;
      }

      if (tab === 'suscripciones') {
        const data = await api('/admin/subscriptions');
        const subscriptions = data.subscriptions || [];
        const active = subscriptions.filter(s => s.status === 'activa');
        const html = subscriptions.map(s => `<div class="card row between"><div><b>${esc(s.name)}</b><div class="small muted">Plan ${esc(s.plan)} · inicio ${fmtHora(s.started_at)} · vence ${fmtHora(s.expires_at)} · ${fmtCLP(s.amount)}</div></div><span class="pill pill-pro">${esc(s.status)}</span></div>`).join('') || '<div class="empty">No hay suscripciones.</div>';
        shell('Suscripciones PRO', `<div class="admin-grid"><div class="stat-card"><b>${active.length}</b><span>Activas</span></div><div class="stat-card"><b>${active.filter(s => s.plan === 'MENSUAL').length}</b><span>Mensuales</span></div><div class="stat-card"><b>${active.filter(s => s.plan === 'ANUAL').length}</b><span>Anuales</span></div></div>${html}`);
      }
    } catch (e) {
      toast(e.message || 'No se pudo cargar el panel administrativo', 'err');
    }
  };

  routes.pro = async function () {
    if (!ME || ME.role !== 'trabajador') return originalPro();
    try {
      const cfg = await api('/config');
      const sub = await api('/worker/subscription');
      const monthly = Number(cfg.pro_price || 9990);
      const annual = Number(cfg.pro_annual_price || Math.round(monthly * 10));
      view.innerHTML = `<div class="card" style="max-width:620px;margin:20px auto;text-align:center"><div style="font-size:44px">⭐</div><h2>DatoYa PRO</h2><p class="muted">Elige tu suscripción profesional mensual o anual.</p><div class="row wrap" style="align-items:stretch;margin-top:18px"><div class="card" style="flex:1;min-width:220px"><h3>Mensual</h3><b style="font-size:28px">${fmtCLP(monthly)}</b><span>/mes</span><p class="small muted">30 días de acceso.</p><button class="btn btn-primary btn-block" onclick="activateSubscription('MENSUAL')">${sub.subscription?.plan === 'MENSUAL' ? 'Renovar' : 'Suscribirme'}</button></div><div class="card" style="flex:1;min-width:220px"><h3>🏆 Anual</h3><b style="font-size:28px">${fmtCLP(annual)}</b><span>/año</span><p class="small muted">365 días de acceso.</p><button class="btn btn-accent btn-block" onclick="activateSubscription('ANUAL')">${sub.subscription?.plan === 'ANUAL' ? 'Renovar' : 'Elegir anual'}</button></div></div><div class="card" style="margin-top:16px;text-align:left"><h3>Incluye</h3><p>✓ Mayor visibilidad · ✓ insignia PRO · ✓ estadísticas · ✓ hasta 12 fotos · ✓ prioridad en solicitudes</p></div><div class="lock-note">MODO DEMO: no se realizó ningún cobro real.</div>${sub.subscription ? `<p class="small muted">Tu plan actual: <b>${esc(sub.subscription.plan)}</b> · vence ${fmtHora(sub.subscription.expires_at)}</p>` : ''}</div>`;
    } catch (e) {
      toast(e.message || 'No se pudo cargar DatoYa PRO', 'err');
    }
  };

  window.activateSubscription = async function (plan) {
    try { const r = await api('/worker/subscription', { method: 'POST', body: { plan } }); toast(r.message, 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.resolveAdminVerification = async function (id, action) {
    try { const r = await api('/admin/verification-requests/' + id + '/resolve', { method: 'POST', body: { action } }); toast(r.status === 'aprobada' ? 'Verificación aprobada ✓' : 'Solicitud rechazada', 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.resolveReport = async function (id, status) {
    try { const r = await api('/admin/reports/' + id + '/resolve', { method: 'POST', body: { status } }); toast(r.message || 'Denuncia actualizada', 'ok'); route(); }
    catch (e) { toast(e.message, 'err'); }
  };

  window.openReportCase = async function (id) {
    try {
      const c = await api('/admin/reports/' + id + '/case');
      const r = c.report || {};
      const reporter = c.reporter || {};
      const target = c.target || {};
      const job = c.job;
      const request = c.request;
      const evidenceCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
      const photoCount = Array.isArray(c.photos) ? c.photos.length : 0;
      const messageCount = Array.isArray(c.messages) ? c.messages.length : 0;
      const historyCount = Array.isArray(c.history) ? c.history.length : 0;
      let related = '';
      if (job) related = `<div class="card"><b>🛠️ Trabajo #${job.id}</b><div class="small">${esc(job.request_title || 'Servicio')} · ${esc(job.comuna || 'Comuna no indicada')}</div><div class="small muted">Estado: ${esc(job.status)} · Precio: ${fmtCLP(job.price)} · Solicitud #${job.request_id}</div><p class="small">${esc(job.request_description || 'Sin descripción')}</p></div>`;
      else if (request) related = `<div class="card"><b>📋 Solicitud #${request.id}</b><div class="small">${esc(request.title || 'Servicio')} · ${esc(request.comuna || 'Comuna no indicada')}</div><div class="small muted">Estado: ${esc(request.status)}</div><p class="small">${esc(request.description || 'Sin descripción')}</p></div>`;
      const messages = messageCount ? `<div class="card"><b>💬 Conversación relacionada</b>${c.messages.slice(-30).map(m => `<div class="small" style="padding:7px 0;border-bottom:1px solid var(--borde)"><b>${esc(m.sender_name)}</b> <span class="muted">(${esc(m.sender_role)})</span>: ${esc(m.body)}</div>`).join('')}</div>` : '';
      const history = historyCount ? `<div class="card"><b>🕘 Historial del trabajo</b>${c.history.map(h => `<div class="small" style="padding:5px 0"><b>${esc(h.status)}</b> · ${esc(h.changed_by_name || 'Sistema')} · ${fmtHora(h.created_at)}</div>`).join('')}</div>` : '';
      openModal(`<h3>📁 Expediente de denuncia #${r.id}</h3><div class="small muted">Estado: ${esc(r.status)} · Creada: ${fmtHora(r.created_at)}</div><div class="admin-grid" style="margin:14px 0"><div class="stat-card"><span>Denunciante</span><b style="font-size:17px">${esc(reporter.name || '—')}</b><small>${reportRole(reporter.role)}</small></div><div class="stat-card"><span>Denunciado</span><b style="font-size:17px">${esc(target.name || 'No identificado')}</b><small>${reportRole(target.role)}</small></div><div class="stat-card"><b>${evidenceCount}</b><span>Evidencias</span></div><div class="stat-card"><b>${photoCount}</b><span>Fotos</span></div></div><div class="card"><b>⚑ Motivo</b><p class="small">${esc(String(r.reason || '').replace(/_/g, ' '))}</p><b>Detalles</b><p class="small">${esc(r.details || 'Sin detalles')}</p><b>Dirección</b><p class="small">${esc(c.direction || '—')}</p></div>${related}${messages}${history}<div class="lock-note">Expediente administrativo de soporte y resolución.</div>`);
    } catch (e) { toast(e.message, 'err'); }
  };

  window.openDisputeCase = async function (id) {
    try {
      const c = await api('/admin/disputes/' + id + '/case');
      openModal(`<h3>⚖️ Expediente de disputa #${id}</h3><pre style="white-space:pre-wrap">${esc(JSON.stringify(c, null, 2))}</pre>`);
    } catch (e) { toast(e.message, 'err'); }
  };

  window.startDisputeReview = async function (id) {
    return window.openDisputeCase(id);
  };
})();

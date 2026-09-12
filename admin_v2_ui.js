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

  function reportRole(role) {
    return role === 'cliente' ? '👤 Cliente' : role === 'trabajador' ? '🔧 Profesional' : role === 'admin' ? '🛡️ Admin' : esc(role || '—');
  }

  routes.admin = async function (tab = 'dashboard') {
    if (!ME || ME.role !== 'admin') { view.innerHTML = '<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>'; return; }
    if (!['reclamos','disputas','ganancias','banco','mensajes','suscripciones','verificaciones'].includes(tab)) return originalAdmin(tab);
    if (tab === 'verificaciones') {
      const { requests } = await api('/admin/verification-requests');
      shell('Verificaciones profesionales', `<div class="lock-note">🪪 Revisa la solicitud, el tipo de respaldo, la referencia y el ticket. En esta versión DEMO no se almacenan documentos de identidad reales.</div>${requests.map(v => `<div class="card"><div class="row between"><div><b>🪪 ${esc(v.name)}</b><div class="small muted">${esc(v.oficio)} · ${esc(v.email)}</div></div><span class="status-tag ${v.status==='pendiente'?'st-DISPUTA':v.status==='aprobada'?'st-FINALIZADO':'st-CANCELADO'}">${esc(v.status)}</span></div><div class="small" style="margin-top:10px"><b>Ticket:</b> ${esc(v.ticket||('VER-'+v.id))}</div><div class="small"><b>Documento:</b> ${esc(v.document_type||v.type||'No indicado')}</div><div class="small"><b>Referencia:</b> ${esc(v.document_reference||'No indicada')}</div><div class="small muted" style="margin-top:6px">Solicitud #${v.id} · ${fmtHora(v.created_at)}</div>${v.status==='pendiente'?`<div class="row" style="margin-top:12px"><button class="btn btn-green btn-sm" onclick="resolveAdminVerification(${v.id},'aprobar')">✓ Aprobar verificación</button><button class="btn btn-danger btn-sm" onclick="resolveAdminVerification(${v.id},'rechazar')">Rechazar</button></div>`:''}</div>`).join('')||'<div class="empty"><b>✓</b>No hay solicitudes de verificación.</div>'}`);
      return;
    }
    if (tab === 'reclamos') {
      const { reports } = await api('/admin/reports');
      shell('Reclamos y denuncias', `<div class="lock-note">⚑ Cada denuncia muestra claramente quién denuncia y a quién se denuncia. Si está vinculada a un trabajo, también puedes abrir el expediente completo con solicitud, profesional, mensajes e historial.</div>${reports.map(r => `<div class="card"><div class="row between"><b>⚑ ${esc(r.reason.replace(/_/g,' '))}</b><span class="status-tag ${r.status==='pendiente'?'st-DISPUTA':r.status==='resuelta'?'st-FINALIZADO':'st-CANCELADO'}">${esc(r.status)}</span></div><div class="admin-grid" style="margin:12px 0"><div class="stat-card"><span>Denunciante</span><b style="font-size:16px">${esc(r.reporter_name||r.reporter||'—')}</b><small>${reportRole(r.reporter_role)}</small></div><div class="stat-card"><span>Denunciado</span><b style="font-size:16px">${esc(r.target_name||'No identificado')}</b><small>${reportRole(r.target_role)}</small></div></div><div class="small"><b>Dirección:</b> ${esc(r.direction||'—')}</div><div class="small muted">Ticket #${r.id} · ${esc(r.target_type)} #${r.target_id} · ${fmtHora(r.created_at)}</div>${r.job?`<div class="small muted" style="margin-top:5px"><b>Trabajo #${r.job.id}</b> · ${esc(r.job.request_title||'Servicio')} · ${esc(r.job.comuna||'Comuna no indicada')} · ${fmtCLP(r.job.price)}</div>`:r.request?`<div class="small muted" style="margin-top:5px"><b>Solicitud #${r.request.id}</b> · ${esc(r.request.title||'Servicio')} · ${esc(r.request.comuna||'Comuna no indicada')}</div>`:''}<p class="small">${esc(r.details||'Sin detalles')}</p><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openReportCase(${r.id})">📁 Ver expediente</button>${r.status==='pendiente'?`<button class="btn btn-green btn-sm" onclick="resolveReport(${r.id},'resuelta')">Resolver</button><button class="btn btn-ghost btn-sm" onclick="resolveReport(${r.id},'descartada')">Descartar</button>`:''}</div></div>`).join('')||'<div class="empty">No hay reclamos.</div>');
    } else if (tab === 'disputas') {
      const { disputes } = await api('/admin/disputes');
      shell('Disputas de trabajos', disputes.map(d => `<div class="card"><div class="row between"><b>⚖️ Disputa #${d.id}</b><span class="status-tag st-DISPUTA">${esc(d.status)}</span></div><div class="small muted">Cliente: ${esc(d.client_name)} · Profesional: ${esc(d.worker_name)} · ${fmtCLP(d.price)}</div><div class="small muted">Creada: ${fmtHora(d.created_at)}</div><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openDisputeCase(${d.id})">📁 Ver expediente</button><button class="btn btn-outline btn-sm" onclick="startDisputeReview(${d.id})">Revisar</button></div></div>`).join('')||'<div class="empty">No hay disputas abiertas.</div>');
    } else if (tab === 'ganancias') {
      const r = await api('/admin/earnings');
      shell('Ganancias DatoYa', `<div class="admin-grid"><div class="stat-card"><b>${fmtCLP(r.gross)}</b><span>Volumen bruto</span></div><div class="stat-card"><b>${fmtCLP(r.commissions)}</b><span>Comisiones DatoYa</span></div><div class="stat-card"><b>${fmtCLP(r.workers)}</b><span>Parte profesionales</span></div><div class="stat-card"><b>${fmtCLP(r.payouts)}</b><span>Retiros pagados</span></div></div><div class="lock-note" style="margin-top:12px">MODO DEMO: estas cifras son internas de prueba. La comisión configurada actualmente es 10%.</div>`);
    } else if (tab === 'banco') {
      const r = await api('/admin/bank');
      shell('Banco y retiros', `<div class="lock-note">🏦 MODO DEMO: DatoYa no procesa dinero real todavía. Los datos bancarios reales se incorporarán mediante un proveedor seguro antes de producción.</div>${r.accounts.map(a => `<div class="card row between"><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)} · ${a.is_pro?'⭐ PRO':''} · ${a.verified_identity?'✓ Verificado':'Sin verificar'}${a.bank_name?` · ${esc(a.bank_name)} (${esc(a.account_type||'')}) •••• ${esc(a.account_last4||'')}`:' · Sin cuenta registrada'}</div></div><span class="pill">${a.bank_name?'Cuenta registrada':'Pendiente'}</span></div>`).join('')||'<div class="empty">No hay profesionales.</div>'}`);
    } else if (tab === 'mensajes') {
      const { conversations } = await api('/admin/messages');
      shell('Mensajes', `<div class="lock-note">El administrador puede supervisar la existencia y actividad de conversaciones, pero no debe modificar mensajes de usuarios sin un procedimiento de soporte.</div>${conversations.map(c => `<div class="card"><div class="row between"><b>💬 ${esc(c.client_name)} ↔ ${esc(c.worker_name)}</b><span class="small muted">${fmtHora(c.last_at||c.created_at)}</span></div><div class="small muted">${c.job_id?'Trabajo #'+c.job_id:'Solicitud #'+c.request_id}</div><p class="small">${esc(c.last_msg||'Sin mensajes')}</p></div>`).join('')||'<div class="empty">No hay conversaciones.</div>'}`);
    } else if (tab === 'suscripciones') {
      const { subscriptions } = await api('/admin/subscriptions');
      shell('Suscripciones PRO', `<div class="admin-grid"><div class="stat-card"><b>${subscriptions.filter(s=>s.status==='activa').length}</b><span>Activas</span></div><div class="stat-card"><b>${subscriptions.filter(s=>s.plan==='MENSUAL'&&s.status==='activa').length}</b><span>Mensuales</span></div><div class="stat-card"><b>${subscriptions.filter(s=>s.plan==='ANUAL'&&s.status==='activa').length}</b><span>Anuales</span></div></div>${subscriptions.map(s=>`<div class="card row between"><div><b>${esc(s.name)}</b><div class="small muted">Plan ${s.plan} · inicio ${fmtHora(s.started_at)} · vence ${fmtHora(s.expires_at)} · ${fmtCLP(s.amount)}</div></div><span class="pill pill-pro">${s.status}</span></div>`).join('')||'<div class="empty">No hay suscripciones.</div>'}`);
    }
  };

  routes.pro = async function () {
    if (!ME || ME.role !== 'trabajador') return originalPro();
    const cfg = await api('/config');
    const sub = await api('/worker/subscription');
    const monthly = Number(cfg.pro_price || 9990);
    const annual = Number(cfg.pro_annual_price || Math.round(monthly * 10));
    view.innerHTML = `<div class="card" style="max-width:620px;margin:20px auto;text-align:center"><div style="font-size:44px">⭐</div><h2>DatoYa PRO</h2><p class="muted">Elige tu suscripción profesional mensual o anual.</p><div class="row wrap" style="align-items:stretch;margin-top:18px"><div class="card" style="flex:1;min-width:220px;border:2px solid var(--borde)"><h3>Mensual</h3><b style="font-size:28px">${fmtCLP(monthly)}</b><span>/mes</span><p class="small muted">30 días de acceso.</p><button class="btn btn-primary btn-block" onclick="activateSubscription('MENSUAL')">${sub.subscription?.plan==='MENSUAL'?'Renovar':'Suscribirme'}</button></div><div class="card" style="flex:1;min-width:220px;border:2px solid var(--ambar)"><h3>🏆 Anual</h3><b style="font-size:28px">${fmtCLP(annual)}</b><span>/año</span><p class="small muted">365 días de acceso.</p><button class="btn btn-accent btn-block" onclick="activateSubscription('ANUAL')">${sub.subscription?.plan==='ANUAL'?'Renovar':'Elegir anual'}</button></div></div><div class="card" style="margin-top:16px;text-align:left"><h3>Incluye</h3><p>✓ Mayor visibilidad · ✓ insignia PRO · ✓ estadísticas · ✓ hasta 12 fotos · ✓ prioridad en solicitudes</p></div><div class="lock-note">MODO DEMO: todavía no se cobra dinero real. Antes de producción se conectará una pasarela y renovación automática segura.</div>${sub.subscription?`<p class="small muted">Tu plan actual: <b>${sub.subscription.plan}</b> · vence ${fmtHora(sub.subscription.expires_at)}</p>`:''}</div>`;
  };

  window.activateSubscription = async function(plan) {
    try { const r = await api('/worker/subscription',{method:'POST',body:{plan}}); toast(r.message,'ok'); route(); }
    catch(e){ toast(e.message,'err'); }
  };

  window.resolveAdminVerification = async function(id, action) {
    try { const r = await api('/admin/verification-requests/'+id+'/resolve',{method:'POST',body:{action}}); toast(r.status==='aprobada'?'Verificación aprobada ✓':'Solicitud rechazada','ok'); route(); }
    catch(e){ toast(e.message,'err'); }
  };

  window.openReportCase = async function(id) {
    try {
      const c = await api('/admin/reports/'+id+'/case');
      const r = c.report || {};
      const reporter = c.reporter || {};
      const target = c.target || {};
      const job = c.job;
      const request = c.request;
      const evidenceCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
      const photoCount = Array.isArray(c.photos) ? c.photos.length : 0;
      const messageCount = Array.isArray(c.messages) ? c.messages.length : 0;
      const historyCount = Array.isArray(c.history) ? c.history.length : 0;
      const jobHtml = job ? `<div class="card"><b>🛠️ Trabajo #${job.id}</b><div class="small">${esc(job.request_title||'Servicio')} · ${esc(job.comuna||'Comuna no indicada')}</div><div class="small muted">Estado: ${esc(job.status)} · Precio: ${fmtCLP(job.price)} · Solicitud #${job.request_id}</div><p class="small">${esc(job.request_description||'Sin descripción')}</p></div>` : request ? `<div class="card"><b>📋 Solicitud #${request.id}</b><div class="small">${esc(request.title||'Servicio')} · ${esc(request.comuna||'Comuna no indicada')}</div><div class="small muted">Estado: ${esc(request.status)}</div><p class="small">${esc(request.description||'Sin descripción')}</p></div>` : '<div class="card"><b>Sin trabajo o solicitud vinculada</b><p class="small muted">La denuncia fue registrada directamente sobre un usuario.</p></div>';
      const messagesHtml = messageCount ? `<div class="card"><b>💬 Conversación relacionada</b>${c.messages.slice(-30).map(m=>`<div class="small" style="padding:7px 0;border-bottom:1px solid var(--borde)"><b>${esc(m.sender_name)}</b> <span class="muted">(${esc(m.sender_role)})</span>: ${esc(m.body)}</div>`).join('')}</div>` : '';
      const historyHtml = historyCount ? `<div class="card"><b>🕘 Historial del trabajo</b>${c.history.map(h=>`<div class="small" style="padding:5px 0"><b>${esc(h.status)}</b> · ${esc(h.changed_by_name||'Sistema')} · ${fmtHora(h.created_at)}</div>`).join('')}</div>` : '';
      openModal(`<h3>📁 Expediente de denuncia #${r.id}</h3><div class="small muted">Estado: ${esc(r.status)} · Creada: ${fmtHora(r.created_at)}</div><div class="admin-grid" style="margin:14px 0"><div class="stat-card"><span>Denunciante</span><b style="font-size:17px">${esc(reporter.name||'—')}</b><small>${reportRole(reporter.role)}</small></div><div class="stat-card"><span>Denunciado</span><b style="font-size:17px">${esc(target.name||'No identificado')}</b><small>${reportRole(target.role)}</small></div><div class="stat-card"><b>${evidenceCount}</b><span>Evidencias</span></div><div class="stat-card"><b>${photoCount}</b><span>Fotos</span></div></div><div class="card"><b>⚑ Motivo</b><p class="small">${esc(String(r.reason||'').replace(/_/g,' '))}</p><b>Detalles</b><p class="small">${esc(r.details||'Sin detalles')}</p><b>Dirección</b><p class="small">${esc(c.direction||'—')}</p></div><div class="card"><b>👤 Partes involucradas</b><p class="small"><b>Denunciante:</b> ${esc(reporter.name||'—')} · ${reportRole(reporter.role)}</p><p class="small"><b>Denunciado:</b> ${esc(target.name||'—')} · ${reportRole(target.role)}</p>${target.oficio?`<p class="small"><b>Oficio:</b> ${esc(target.oficio)} · ${target.verified_identity?'✓ Verificado':'Sin verificar'}${target.is_pro?' · ⭐ PRO':''}</p>`:''}</div>${jobHtml}${messagesHtml}${historyHtml}<div class="lock-note">Este expediente está pensado para resolver la denuncia sin tener que buscar manualmente al cliente, profesional, solicitud o trabajo relacionado. La información se mantiene dentro del panel administrativo.</div>`);
    } catch(e) { toast(e.message,'err'); }
  };

  window.startDisputeReview = async function(id) {
    try {
      const reason = prompt('Motivo de revisión administrativa:');
      if (!reason) return;
      const r = await api('/admin/jobs/'+id+'/dispute/review',{method:'POST',body:{reason}});
      toast('Disputa enviada a revisión ✓','ok'); openDisputeCase(id);
    } catch(e) { toast(e.message,'err'); }
  };

  window.openDisputeCase = async function(id) {
    try {
      const c = await api('/admin/jobs/'+id+'/dispute/case');
      const d = c.dispute;
      openModal(`<h3>📁 Expediente del trabajo #${id}</h3><div class="small muted">Estado del trabajo: ${esc(c.job.status)} · Protección: ${esc(c.protection?.status||'—')} · Disputa: ${esc(d?.status||'—')}</div><div class="admin-grid" style="margin:14px 0"><div class="stat-card"><b>${c.evidence?.length||0}</b><span>Evidencias</span></div><div class="stat-card"><b>${c.photos?.length||0}</b><span>Fotos</span></div><div class="stat-card"><b>${c.messages?.length||0}</b><span>Mensajes</span></div><div class="stat-card"><b>${c.history?.length||0}</b><span>Cambios de estado</span></div></div><div class="card"><b>Motivo</b><p class="small">${esc(d?.reason||c.protection?.dispute_reason||'Sin motivo registrado')}</p><b>Resolución actual</b><p class="small">${esc(d?.resolution||c.protection?.resolution||'Sin resolución')}</p></div><div class="card"><b>Acciones</b><div class="row" style="margin-top:10px"><button class="btn btn-outline btn-sm" onclick="startDisputeReview(${id})">🔎 Iniciar revisión</button><button class="btn btn-accent btn-sm" onclick="requestDisputeCorrection(${id})">🛠️ Solicitar corrección</button></div></div><div class="lock-note">El expediente conserva evidencias, fotos, mensajes e historial para auditoría. MODO DEMO: ninguna decisión libera o transfiere dinero real.</div>`);
    } catch(e) { toast(e.message,'err'); }
  };

  window.requestDisputeCorrection = async function(id) {
    try {
      const resolution = prompt('Indica qué debe corregir el profesional:');
      if (!resolution) return;
      await api('/admin/jobs/'+id+'/protection/resolve',{method:'POST',body:{action:'correction',resolution}});
      toast('Corrección solicitada al profesional ✓','ok'); closeModal(); route();
    } catch(e) { toast(e.message,'err'); }
  };
})();

// DatoYa 2.0 — DatoYa PRO, ganancias y retiros DEMO del profesional.
(() => {
  const previousPerfil = routes.perfil;
  const escFin = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const moneyFin = value => '$' + Number(value || 0).toLocaleString('es-CL');

  routes.perfil = async function() {
    await previousPerfil();
    if (!ME || ME.role !== 'trabajador') return;
    try {
      const e = await api('/worker/earnings');
      const card=document.createElement('div');
      card.className='card';
      card.innerHTML=`<div class="row between" style="align-items:flex-start;gap:10px"><div><h3 style="margin:0">💰 Ganancias y retiros</h3><div class="small muted" style="margin-top:5px">Disponible para retiro: <b>${moneyFin(e.disponible)}</b></div></div><a class="btn btn-primary btn-sm" href="#/ganancias">Ver detalle</a></div>`;
      view.appendChild(card);
    } catch (_) {}
  };

  routes.ganancias = async function() {
    if (!ME) { location.hash='#/login'; return; }
    if (ME.role !== 'trabajador') { view.innerHTML='<div class="empty">Esta sección es para profesionales.</div>'; return; }
    const [e,bank] = await Promise.all([
      api('/worker/earnings'),
      api('/worker/bank').catch(()=>({account:null}))
    ]);
    const jobs=e.jobs || [];
    view.innerHTML=`
      <a href="#/perfil" class="small">← Volver al perfil</a>
      <h2 class="section-title">💰 Ganancias</h2>
      <div class="lock-note">MODO DEMO: los saldos y retiros son simulados. No se realiza ninguna transferencia bancaria real.</div>
      <div class="admin-grid" style="margin:12px 0">
        <div class="stat-card"><b>${moneyFin(e.total_bruto)}</b><span>Ganado por trabajos</span></div>
        <div class="stat-card"><b>${moneyFin(e.comisiones_datoya)}</b><span>Comisiones DatoYa</span></div>
        <div class="stat-card"><b>${moneyFin(e.retiros)}</b><span>Retiros solicitados/pagados</span></div>
        <div class="stat-card"><b>${moneyFin(e.disponible)}</b><span>Disponible</span></div>
      </div>
      <div class="card">
        <div class="row between" style="align-items:flex-start;gap:10px">
          <div><h3 style="margin:0">🏦 Retirar saldo</h3><div class="small muted" style="margin-top:5px">${bank.account ? `${escFin(bank.account.bank_name)} · ${escFin(bank.account.account_type)} · •••• ${escFin(bank.account.account_last4)}` : 'Primero registra tu cuenta para retiros en tu perfil.'}</div></div>
          ${Number(e.disponible)>0 && bank.account ? '<button class="btn btn-green" onclick="requestWorkerPayout()">Solicitar retiro</button>' : '<a class="btn btn-outline btn-sm" href="#/perfil">Configurar cuenta</a>'}
        </div>
      </div>
      <h3 class="section-title">Trabajos finalizados</h3>
      ${jobs.length ? jobs.map(j=>`<div class="card"><div class="row between"><div><b>Trabajo #${Number(j.id)}</b><div class="small muted">Cliente: ${escFin(j.client || '—')} · ${fmtHora(j.created_at)}</div></div><div style="text-align:right"><b>${moneyFin(j.worker_amount)}</b><div class="small muted">Comisión ${moneyFin(j.commission_amount)}</div></div></div></div>`).join('') : '<div class="empty">Todavía no tienes trabajos finalizados con saldo.</div>'}`;
  };

  window.requestWorkerPayout = async function() {
    if (!confirm('¿Solicitar retiro de todo tu saldo disponible? Esta operación sigue siendo DEMO.')) return;
    try {
      const r=await api('/worker/payout',{method:'POST'});
      toast(r.message || `Retiro DEMO solicitado por ${moneyFin(r.amount)}.`,'ok');
      route();
    } catch (e) { toast(e.message,'err'); }
  };

  routes.pro = async function() {
    if (!ME) { location.hash='#/login'; return; }
    if (ME.role !== 'trabajador') {
      view.innerHTML='<div class="card"><b style="font-size:46px">⭐</b><h2>DatoYa PRO</h2><p>Los planes PRO son para profesionales que ofrecen servicios en DatoYa.</p><a class="btn btn-primary" href="#/trabaja">Quiero ofrecer servicios</a></div>';
      return;
    }
    const [config,subData]=await Promise.all([api('/config'),api('/worker/subscription')]);
    const sub=subData.subscription;
    const monthly=Number(config.pro_price || 9990);
    const annual=Math.round(monthly*10);
    view.innerHTML=`
      <a href="#/perfil" class="small">← Volver al perfil</a>
      <div class="card" style="text-align:center;max-width:720px;margin:16px auto">
        <div style="font-size:54px">⭐</div><h2>DatoYa PRO</h2>
        ${sub ? `<div class="lock-note" style="text-align:left">✅ Plan <b>${escFin(sub.plan)}</b> activo hasta ${fmtHora(sub.expires_at)}. Activar otro plan reemplaza la suscripción DEMO actual.</div>` : '<p class="muted">Destaca tu perfil y amplía las herramientas disponibles para mostrar tus trabajos.</p>'}
        <div class="cards" style="margin-top:16px;text-align:left">
          <div class="card"><h3>Mensual</h3><div style="font-size:27px;font-weight:800">${moneyFin(monthly)} <span class="small muted">/ mes</span></div><ul><li>Perfil PRO</li><li>Hasta 12 fotos en portafolio</li><li>Distintivo PRO visible</li></ul><button class="btn btn-primary btn-block" onclick="activateDatoYaPro('MENSUAL')">Activar mensual</button></div>
          <div class="card"><h3>Anual</h3><div style="font-size:27px;font-weight:800">${moneyFin(annual)} <span class="small muted">/ año</span></div><ul><li>Incluye beneficios PRO</li><li>Equivale a 10 mensualidades</li><li>Vigencia DEMO de 365 días</li></ul><button class="btn btn-accent btn-block" onclick="activateDatoYaPro('ANUAL')">Activar anual</button></div>
        </div>
        <div class="lock-note" style="margin-top:14px;text-align:left">MODO DEMO: activar un plan no realiza un cobro real. Los pagos reales se conectarán más adelante mediante un proveedor de pago.</div>
      </div>`;
  };

  window.activateDatoYaPro = async function(plan) {
    if (!confirm(`¿Activar el plan ${plan} en MODO DEMO? No se realizará ningún cobro real.`)) return;
    try {
      const r=await api('/worker/subscription',{method:'POST',body:{plan}});
      await refreshMe();
      toast(r.message || 'DatoYa PRO activado.','ok');
      route();
    } catch (e) { toast(e.message,'err'); }
  };
})();

/* DatoYa — plan DatoYa Impulso para cuentas negocio. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const date=v=>{try{return new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})}catch(_){return String(v||'')}};

  routes['mi-negocio-plan']=async function(id){
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    id=Number(id||0);
    try{
      let data=await api('/businesses/'+id+'/impulso-plan');
      if(data.pending_payment){
        try{await api('/businesses/'+id+'/impulso-plan/sync',{method:'POST',body:{}});data=await api('/businesses/'+id+'/impulso-plan');}catch(_){}
      }
      const m=data.membership,cfg=data.config||{},active=!!m,usage=data.usage||{};
      const freeLimit=Number(cfg.free_catalog_limit||20),paidLimit=Number(cfg.paid_catalog_limit||200);
      const canCheckout=!!cfg.checkout_enabled&&(cfg.checkout_mode!=='live'||cfg.live_payments_allowed);
      const rows=[
        ['Perfil público del negocio','✓','✓'],
        ['Ubicación, horarios y WhatsApp','✓','✓'],
        ['Pedidos y gestión de estados','✓','✓'],
        ['Retiro y despacho propio','✓','✓'],
        ['Soporte dentro de DatoYa','✓','✓'],
        ['QR y enlace para compartir','✓','✓'],
        ['Panel básico del negocio','✓','✓'],
        ['Productos en catálogo','Hasta '+freeLimit,'Hasta '+paidLimit],
        ['⚡ Impulso Ahora','🔒','✓'],
        ['📊 Estadísticas avanzadas','🔒','✓'],
        ['✨ Perfil destacado','🔒','Próximamente'],
        ['📍 Pulso Local','🔒','✓'],
        ['🎯 Radar de oportunidades','🔒','✓'],
        ['🔔 Prioridad en DatoYa Alerta','🔒','Próximamente']
      ];
      view.innerHTML=`<div class="dy-plan-page">
        <a class="dy-plan-back" href="#/mi-negocio/${id}">← Volver a ${h(data.business.name)}</a>
        <section class="dy-plan-hero ${active?'active':''}">
          <div><span>⚡ DATOYA IMPULSO</span><h1>${active?'Tu negocio tiene DatoYa Impulso':'Gratis para operar. Impulso para crecer.'}</h1><p>${active?'Tu acceso está activo hasta el '+h(date(m.expires_at))+'.':'Puedes vender y administrar tu negocio gratis. Las herramientas de crecimiento se desbloquean con DatoYa Impulso.'}</p></div>
          <div class="dy-plan-status">${active?'<b>IMPULSO ACTIVO</b><small>'+h(m.source==='gift'?'Cortesía DatoYa':m.billing_period==='annual'?'Plan anual':m.billing_period==='quarterly'?'Plan 3 meses':'Plan mensual')+'</small>':'<b>PLAN GRATIS</b><small>'+Number(usage.products||0)+' / '+freeLimit+' productos</small>'}</div>
        </section>

        <section class="dy-plan-clarity">
          <div><span>✓</span><b>Lo esencial siempre es gratis</b><p>Perfil, pedidos, soporte, horarios, retiro/despacho y hasta ${freeLimit} productos.</p></div>
          <div><span>🔒</span><b>Lo premium está marcado</b><p>Impulso Ahora, estadísticas avanzadas y herramientas de crecimiento requieren una membresía activa.</p></div>
          <div><span>⭐</span><b>Impulso de la semana va aparte</b><p>No está incluido en la membresía. Puede contratarse por separado o ser regalado por DatoYa.</p></div>
        </section>

        <section class="dy-plan-card dy-plan-comparison">
          <div class="dy-card-head"><div><span>COMPARACIÓN CLARA</span><h2>Gratis vs DatoYa Impulso</h2><p>Los tres períodos de Impulso desbloquean exactamente las mismas funciones; solo cambia la duración y el ahorro.</p></div></div>
          <div class="dy-plan-table">
            <div class="dy-plan-table-head"><b>Función</b><b>Gratis · $0</b><b>⚡ Impulso</b></div>
            ${rows.map(r=>`<div class="dy-plan-table-row"><span>${h(r[0])}</span><strong class="${r[1]==='🔒'?'locked':''}">${h(r[1])}</strong><strong>${h(r[2])}</strong></div>`).join('')}
          </div>
        </section>

        <div class="dy-plan-grid">
          <section class="dy-plan-card free">
            <span>PLAN GRATIS</span><h2>$0</h2><p>Para operar un negocio real dentro de DatoYa sin mensualidad.</p>
            <ul><li>Hasta <b>${freeLimit} productos</b></li><li>Perfil, horarios y ubicación</li><li>Pedidos sin límite de cantidad</li><li>Retiro y despacho propio</li><li>Soporte DatoYa</li><li>Panel básico y QR compartible</li></ul>
            <div class="dy-plan-current">${active?'Disponible como base del plan':'✓ Este es tu plan actual'}</div><div class="dy-plan-limit-note">Si tu plan Impulso vence teniendo más de ${freeLimit} productos, DatoYa no los borra. Se conservan, pero no podrás agregar nuevos hasta quedar bajo el límite Gratis o reactivar Impulso.</div>
          </section>
          <section class="dy-plan-card impulse">
            <span>⚡ DATOYA IMPULSO</span><h2>Desde ${money(cfg.monthly_price)} <small>/ mes</small></h2><p>Incluye todo lo Gratis y desbloquea herramientas para crecer.</p>
            <ul><li>📦 Hasta <b>${paidLimit} productos</b></li><li>⚡ Impulso Ahora</li><li>📊 Estadísticas avanzadas</li><li>✨ Perfil destacado <small>(próximamente)</small></li><li>📍 Pulso Local</li><li>🎯 Radar de oportunidades</li><li>🔔 Prioridad en DatoYa Alerta <small>(próximamente)</small></li></ul>
            <div class="dy-plan-options">
              <div class="dy-plan-option"><div><b>Mensual</b><small>${money(cfg.monthly_price)} / mes</small></div><button class="btn btn-outline btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'monthly')">Elegir</button></div>
              <div class="dy-plan-option popular"><div><span>AHORRA ${money((cfg.monthly_price*3)-cfg.quarterly_price)}</span><b>3 meses</b><small><s>${money(cfg.monthly_price*3)}</s> <strong>${money(cfg.quarterly_price)}</strong> · equivale a ${money(Math.round(cfg.quarterly_price/3))}/mes</small></div><button class="btn btn-primary btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'quarterly')">Elegir 3 meses</button></div>
              <div class="dy-plan-option best"><div><span>⭐ MEJOR VALOR · CASI 3 MESES GRATIS</span><b>Anual</b><small><s>${money(cfg.monthly_price*12)}</s> <strong>${money(cfg.annual_price)}</strong> · equivale a ${money(Math.round(cfg.annual_price/12))}/mes</small><em>Ahorras ${money((cfg.monthly_price*12)-cfg.annual_price)} al año</em></div><button class="btn btn-primary btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'annual')">Elegir anual</button></div>
            </div>
            ${!canCheckout?'<div class="dy-plan-note">🔒 La membresía está definida y los candados ya funcionan, pero el cobro sigue deshabilitado mientras terminamos la validación TEST de Mercado Pago.</div>':''}
          </section>
        </div>

        <section class="dy-plan-card dy-plan-weekly">
          <div><span>⭐ DESTACADO APARTE</span><h2>Impulso de la semana</h2><p>No forma parte del plan Gratis ni de DatoYa Impulso. Es una campaña especial por período que puede contratarse aparte o ser entregada como cortesía por DatoYa.</p></div>
          <a class="btn btn-outline" href="#/impulso-semanal-nuevo/${id}">Ver Impulso semanal</a>
        </section>

        ${data.pending_payment?'<section class="dy-plan-card"><h3>Pago pendiente</h3><p>Si ya terminaste el pago en Mercado Pago, puedes actualizar su estado.</p><button class="btn btn-outline" onclick="dySyncImpulsePayment('+id+')">Actualizar pago</button></section>':''}
      </div>`;
    }catch(e){toast?.(e.message||'No se pudo cargar el plan DatoYa Impulso','err');}
  };

  window.dyStartImpulseCheckout=async function(id,period){
    try{
      const r=await api('/businesses/'+id+'/impulso-plan/checkout',{method:'POST',body:{billing_period:period}});
      if(!r.checkout_url)throw new Error('No se recibió la URL de pago');
      location.href=r.checkout_url;
    }catch(e){toast?.(e.message||'No se pudo iniciar el pago','err');}
  };
  window.dySyncImpulsePayment=async function(id){
    try{
      const r=await api('/businesses/'+id+'/impulso-plan/sync',{method:'POST',body:{}});
      toast?.(r.status==='approved'?'Pago aprobado y DatoYa Impulso activado':'Estado actualizado: '+(r.status||'pendiente'),r.status==='approved'?'ok':'info');
      routes['mi-negocio-plan'](id);
    }catch(e){toast?.(e.message||'No se pudo consultar el pago','err');}
  };

  const previousBusiness=routes['mi-negocio'];
  if(previousBusiness)routes['mi-negocio']=async function(id){
    const r=await previousBusiness.apply(this,arguments);
    if(!ME||ME.account_type!=='business')return r;
    const target=document.querySelector('.dy-business-tools');
    if(target&&!target.querySelector('[data-impulso-plan-tool]')){
      const a=document.createElement('a');a.dataset.impulsoPlanTool='1';a.href='#/mi-negocio-plan/'+Number(id);a.innerHTML='<span>⚡</span><b>DatoYa Impulso</b><small>Planes, beneficios y vigencia.</small>';target.prepend(a);
    }
    return r;
  };
})();
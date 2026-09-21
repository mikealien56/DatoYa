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
      const m=data.membership,cfg=data.config||{},active=!!m;
      const canCheckout=!!cfg.checkout_enabled&&(cfg.checkout_mode!=='live'||cfg.live_payments_allowed);
      view.innerHTML=`<div class="dy-plan-page">
        <a class="dy-plan-back" href="#/mi-negocio/${id}">← Volver a ${h(data.business.name)}</a>
        <section class="dy-plan-hero ${active?'active':''}">
          <div><span>⚡ DATOYA IMPULSO</span><h1>${active?'Tu negocio está en Impulso':'Haz crecer la visibilidad de tu negocio'}</h1><p>${active?'Tu acceso está activo hasta el '+h(date(m.expires_at))+'.':'Activa herramientas comerciales y mayor visibilidad dentro de DatoYa.'}</p></div>
          <div class="dy-plan-status">${active?'<b>ACTIVO</b><small>'+h(m.source==='gift'?'Cortesía DatoYa':m.billing_period==='annual'?'Plan anual':m.billing_period==='quarterly'?'Plan 3 meses':'Plan mensual')+'</small>':'<b>GRATIS</b><small>Plan actual</small>'}</div>
        </section>

        <div class="dy-plan-grid">
          <section class="dy-plan-card free">
            <span>PLAN GRATIS</span><h2>$0</h2><p>Para estar presente en DatoYa.</p>
            <ul><li>Perfil del negocio</li><li>Ubicación y horarios</li><li>WhatsApp</li><li>Catálogo básico</li><li>Pedidos y retiro</li></ul>
          </section>
          <section class="dy-plan-card impulse">
            <span>⚡ DATOYA IMPULSO</span><h2>Desde ${money(cfg.monthly_price)} <small>/ mes</small></h2><p>Elige mensual, 3 meses o anual. Mientras más tiempo eliges, más ahorras.</p>
            <ul><li>⚡ Impulso Ahora</li><li>📊 Estadísticas avanzadas</li><li>📍 Pulso Local</li><li>🎯 Radar de oportunidades</li><li>📣 Promociones destacadas</li><li>🔔 Prioridad en DatoYa Alerta</li><li>📦 Catálogo ampliado</li><li>✨ Perfil destacado</li></ul>
            <div class="dy-plan-options">
              <div class="dy-plan-option"><div><b>Mensual</b><small>${money(cfg.monthly_price)} / mes</small></div><button class="btn btn-outline btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'monthly')">Elegir</button></div>
              <div class="dy-plan-option popular"><div><span>AHORRA ${money((cfg.monthly_price*3)-cfg.quarterly_price)}</span><b>3 meses</b><small><s>${money(cfg.monthly_price*3)}</s> <strong>${money(cfg.quarterly_price)}</strong> · equivale a ${money(Math.round(cfg.quarterly_price/3))}/mes</small></div><button class="btn btn-primary btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'quarterly')">Elegir 3 meses</button></div>
              <div class="dy-plan-option best"><div><span>⭐ MEJOR VALOR · CASI 3 MESES GRATIS</span><b>Anual</b><small><s>${money(cfg.monthly_price*12)}</s> <strong>${money(cfg.annual_price)}</strong> · equivale a ${money(Math.round(cfg.annual_price/12))}/mes</small><em>Ahorras ${money((cfg.monthly_price*12)-cfg.annual_price)} al año</em></div><button class="btn btn-primary btn-sm" ${canCheckout?'':'disabled'} onclick="dyStartImpulseCheckout(${id},'annual')">Elegir anual</button></div>
            </div>
            ${!canCheckout?'<div class="dy-plan-note">🔒 El checkout está preparado, pero los cobros siguen bloqueados mientras terminamos la validación TEST de Mercado Pago.</div>':''}
          </section>
        </div>

        <section class="dy-plan-card dy-plan-weekly">
          <div><span>⭐ APARTE DE LA MEMBRESÍA</span><h2>Impulso de la semana</h2><p>Es un destacado promocional especial. Puede ser comprado o regalado por DatoYa y no reemplaza tu membresía mensual.</p></div>
          <a class="btn btn-outline" href="#/impulso-semanal-nuevo/${id}">Preparar oferta semanal</a>
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
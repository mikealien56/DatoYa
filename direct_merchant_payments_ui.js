/* DatoYa — pagos directos al negocio.
   DatoYa gestiona el pedido; el dinero de la venta nunca entra a DatoYa. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');

  async function renderDirectPayments(id){
    id=Number(id||0);
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    view.innerHTML='<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-direct-pay-loading"><span>💳</span><b>Cargando formas de pago…</b></section></div>';
    try{
      const [meta,pref,ordersD]=await Promise.all([
        api('/businesses/'+id+'/manage'),
        api('/businesses/'+id+'/direct-payment-settings'),
        api('/businesses/'+id+'/orders')
      ]);
      const b=meta.business||{},s=pref.settings||{},orders=ordersD.orders||[];
      const paid=orders.filter(o=>String(o.payment_status)==='paid').length;
      const pending=orders.filter(o=>String(o.payment_status)!=='paid'&&String(o.status)!=='cancelled').length;
      view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage">
        <section class="dy-business-dashboard-hero dy-direct-pay-hero">
          <div><span>PAGOS</span><h1>El dinero va directo a ${h(b.name||'tu negocio')}</h1><p>DatoYa organiza pedidos y estados, pero no cobra ni retiene dinero de tus ventas.</p></div>
          <div class="dy-direct-pay-badge"><span>✓</span><div><b>Sin comisión por venta</b><small>DatoYa cobra solo sus servicios opcionales</small></div></div>
        </section>

        <section class="dy-direct-pay-summary">
          <div><span>✅</span><strong>${paid}</strong><b>Pagos registrados</b><small>Marcados por tu negocio</small></div>
          <div><span>⏳</span><strong>${pending}</strong><b>Pendientes</b><small>Pedidos aún sin pago confirmado</small></div>
          <div><span>💸</span><strong>0%</strong><b>Comisión DatoYa</b><small>Sobre tus ventas</small></div>
        </section>

        <section class="dy-business-card dy-direct-pay-settings">
          <div class="dy-card-head"><div><span>FORMAS DE PAGO</span><h2>¿Cómo pueden pagarte?</h2><p>Estas opciones pertenecen a tu negocio. DatoYa solo se las muestra al cliente.</p></div></div>
          <form id="dy-direct-pay-form">
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="pay_at_pickup" ${s.pay_at_pickup?'checked':''}><span>🛍️</span><div><b>Pago al retirar</b><small>El cliente paga directamente cuando retira.</small></div></label>
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="pay_on_delivery" ${s.pay_on_delivery?'checked':''}><span>🚚</span><div><b>Pago al recibir despacho</b><small>Para pedidos con despacho propio.</small></div></label>
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="transfer_enabled" ${s.transfer_enabled?'checked':''}><span>🏦</span><div><b>Transferencia directa</b><small>La coordinación y recepción del pago es entre cliente y negocio.</small></div></label>
            <label class="dy-direct-pay-toggle"><input id="dy-external-pay-enabled" type="checkbox" name="external_payment_enabled" ${s.external_payment_enabled?'checked':''}><span>🔗</span><div><b>Mi propio enlace de pago</b><small>Si ya usas un proveedor de pagos, pega aquí tu enlace https://.</small></div></label>
            <div class="field dy-direct-pay-url" id="dy-external-pay-url-wrap" ${s.external_payment_enabled?'':'hidden'}><label>Enlace de pago del negocio</label><input type="url" name="external_payment_url" value="${h(s.external_payment_url||'')}" placeholder="https://..." maxlength="500"><small>El dinero va a tu proveedor/cuenta, no a DatoYa.</small></div>
            <label class="dy-direct-pay-toggle warning"><input type="checkbox" name="prepayment_required" ${s.prepayment_required?'checked':''}><span>🛡️</span><div><b>Exigir pago antes de preparar</b><small>Útil para reducir pedidos falsos. DatoYa no permitirá pasar a “Preparando” hasta que marques el pago como recibido.</small></div></label>
            <button class="btn btn-primary btn-block" type="submit">Guardar formas de pago</button>
          </form>
        </section>

        <section class="dy-business-card">
          <div class="dy-card-head"><div><span>FLUJO RECOMENDADO</span><h2>Pedido seguro sin que DatoYa toque el dinero</h2></div></div>
          <div class="dy-direct-pay-flow"><div><span>1</span><b>Cliente pide</b><small>DatoYa registra el pedido.</small></div><i>→</i><div><span>2</span><b>Tú confirmas</b><small>Decides si aceptarlo.</small></div><i>→</i><div><span>3</span><b>Cliente te paga</b><small>Directamente a tu negocio.</small></div><i>→</i><div><span>4</span><b>Preparas</b><small>Si exiges prepago, solo después de marcar pagado.</small></div></div>
        </section>

        <section class="dy-direct-pay-note"><span>ℹ️</span><div><b>Khipu en DatoYa queda para servicios DatoYa</b><p>Impulso, Impulso+ y Premium pueden pagarse a DatoYa. Los pedidos de tus clientes no usan la cuenta Khipu de DatoYa.</p></div></section>
      </div>`;
      document.getElementById('dy-external-pay-enabled')?.addEventListener('change',e=>{
        const wrap=document.getElementById('dy-external-pay-url-wrap');
        if(wrap)wrap.hidden=!e.currentTarget.checked;
      });
      document.getElementById('dy-direct-pay-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const btn=e.currentTarget.querySelector('button[type="submit"]'),fd=new FormData(e.currentTarget);
        if(btn){btn.disabled=true;btn.textContent='Guardando…';}
        try{
          await api('/businesses/'+id+'/direct-payment-settings',{method:'PUT',body:{
            pay_at_pickup:fd.has('pay_at_pickup'),
            pay_on_delivery:fd.has('pay_on_delivery'),
            transfer_enabled:fd.has('transfer_enabled'),
            external_payment_enabled:fd.has('external_payment_enabled'),
            external_payment_url:String(fd.get('external_payment_url')||''),
            prepayment_required:fd.has('prepayment_required')
          }});
          toast?.('Formas de pago guardadas','ok');
          renderDirectPayments(id);
        }catch(err){
          if(btn){btn.disabled=false;btn.textContent='Guardar formas de pago';}
          toast?.(err.message||'No se pudo guardar','err');
        }
      });
      await window.__datoyaBusinessHubFrame?.(id,'payments');
      polishBusinessPaymentLabels();
    }catch(err){
      view.innerHTML='<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-direct-pay-loading error"><span>⚠️</span><h2>No pudimos cargar los pagos</h2><p>'+h(err.message||'Intenta nuevamente.')+'</p><button class="btn btn-primary" onclick="routes[\'mi-negocio-pagos\']('+id+')">Reintentar</button></section></div>';
      await window.__datoyaBusinessHubFrame?.(id,'payments');
    }
  }

  routes['mi-negocio-pagos']=renderDirectPayments;

  function directPaymentMarkup(o,data){
    const s=data.settings||{},parts=[];
    if(o.fulfillment_method==='pickup'&&s.pay_at_pickup)parts.push('🛍️ Pago al retirar');
    if(o.fulfillment_method==='delivery'&&s.pay_on_delivery)parts.push('🚚 Pago al recibir');
    if(s.transfer_enabled)parts.push('🏦 Transferencia directa');
    if(s.external_payment_enabled&&s.external_payment_url)parts.push('🔗 Enlace de pago del negocio');
    const wa=String(data.order?.whatsapp||'').replace(/\D/g,'');
    const waHref=wa?'https://wa.me/'+wa+'?text='+encodeURIComponent('Hola, consulto por el pago de mi pedido '+String(o.reference||'')):'';
    return `<div class="dy-direct-customer-pay">
      <div><b>💳 Pago directo a ${h(data.order?.business_name||o.business_name||'este negocio')}</b><p>${s.prepayment_required&&String(o.payment_status)!=='paid'?'Este negocio solicita pago antes de preparar el pedido.':'DatoYa no recibe este dinero.'}</p></div>
      <div class="dy-direct-customer-methods">${parts.map(x=>'<span>'+h(x)+'</span>').join('')}</div>
      <div class="dy-direct-customer-actions">
        ${s.external_payment_enabled&&s.external_payment_url&&String(o.payment_status)!=='paid'?`<a class="btn btn-primary btn-sm" href="${h(s.external_payment_url)}" target="_blank" rel="noopener noreferrer">Pagar al negocio</a>`:''}
        ${waHref&&String(o.payment_status)!=='paid'?`<a class="btn btn-outline btn-sm" href="${h(waHref)}" target="_blank" rel="noopener noreferrer">Coordinar pago</a>`:''}
      </div>
      ${String(o.payment_status)==='paid'?'<small class="paid">✅ El negocio registró este pago como recibido.</small>':''}
    </div>`;
  }

  const baseCustomerOrders=routes.pedidos;
  if(baseCustomerOrders){
    routes.pedidos=async function(){
      const result=await baseCustomerOrders.apply(this,arguments);
      if(!ME||ME.account_type!=='customer')return result;
      try{
        const {orders=[]}=await api('/orders/mine');
        for(const o of orders){
          const card=document.getElementById('dy-order-'+Number(o.id));if(!card)continue;
          const data=await api('/orders/'+Number(o.id)+'/direct-payment-options').catch(()=>null);if(!data)continue;
          const old=card.querySelector('.dy-direct-customer-pay');if(old)old.remove();
          const actions=card.querySelector('button[onclick^="dyCancelOrder"]');
          if(actions)actions.insertAdjacentHTML('beforebegin',directPaymentMarkup(o,data));
          else card.insertAdjacentHTML('beforeend',directPaymentMarkup(o,data));
        }
      }catch(_){}
      return result;
    };
  }

  function polishBusinessPaymentLabels(){
    document.querySelectorAll('.dy-dashboard-growth a[href*="mi-negocio-pagos"]').forEach(a=>{
      const b=a.querySelector('b'),small=a.querySelector('small'),icon=a.querySelector('span');
      if(icon)icon.textContent='💳';
      if(b)b.textContent='Formas de pago';
      if(small)small.textContent='El cliente te paga directamente.';
    });
    document.querySelectorAll('.dy-dashboard-checks>div').forEach(x=>{
      const b=x.querySelector('b'),small=x.querySelector('small'),icon=x.querySelector('span');
      if(b&&b.textContent.trim()==='Khipu'){
        if(icon)icon.textContent='💳';
        b.textContent='Cobro directo';
        if(small)small.textContent='Las ventas se pagan al negocio';
      }
    });
  }

  const baseBusinessHome=routes['mi-negocio'];
  if(baseBusinessHome){
    routes['mi-negocio']=async function(id){
      const r=await baseBusinessHome.apply(this,arguments);
      polishBusinessPaymentLabels();
      return r;
    };
  }
  const baseConfig=routes['mi-negocio-configuracion'];
  if(baseConfig){
    routes['mi-negocio-configuracion']=async function(id){
      const r=await baseConfig.apply(this,arguments);
      polishBusinessPaymentLabels();
      return r;
    };
  }

  window.dyPayOrderKhipu=function(){toast?.('Este pedido se paga directamente al negocio. DatoYa no procesa el dinero de la venta.','info');};
})();

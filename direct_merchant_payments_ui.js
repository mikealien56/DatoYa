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
      const [meta,pref,ordersD,khipuD]=await Promise.all([
        api('/businesses/'+id+'/manage'),
        api('/businesses/'+id+'/direct-payment-settings'),
        api('/businesses/'+id+'/orders'),
        api('/businesses/'+id+'/khipu-direct').catch(()=>({khipu:{connected:false,status:'not_connected'}}))
      ]);
      const b=meta.business||{},s=pref.settings||{},orders=ordersD.orders||[],k=khipuD.khipu||{connected:false,status:'not_connected'};
      const paid=orders.filter(o=>String(o.payment_status)==='paid').length;
      const pending=orders.filter(o=>String(o.payment_status)!=='paid'&&String(o.status)!=='cancelled').length;
      const khipuForm=`<form id="dy-khipu-direct-form" class="dy-khipu-direct-form">
        <div class="dy-khipu-direct-grid">
          <div class="field"><label>ID de cobrador</label><input name="receiver_id" inputmode="numeric" value="${h(k.receiver_id||'')}" placeholder="Ej: 123456" maxlength="20" required><small>Está en Opciones de la cuenta → Para integrar Khipu a tu sitio web.</small></div>
          <div class="field"><label>Llave de Khipu</label><input name="secret" type="password" autocomplete="new-password" placeholder="Pega tu Llave" maxlength="500" required><small>Se usa únicamente para validar las notificaciones de pago.</small></div>
          <div class="field dy-khipu-direct-wide"><label>API Key</label><input name="api_key" type="password" autocomplete="new-password" placeholder="Pega tu Nueva API Key" maxlength="1000" required><small>Khipu la muestra al crearla. Si la perdiste, genera una nueva.</small></div>
        </div>
        <div class="dy-khipu-direct-security"><span>🔒</span><div><b>Tus credenciales se guardan cifradas.</b><small>DatoYa nunca te pedirá tu clave bancaria. La cuenta bancaria se configura directamente en Khipu.</small></div></div>
        <button class="btn btn-primary btn-block" type="submit">${k.connected?'Actualizar conexión Khipu':'Conectar Khipu'}</button>
      </form>`;
      view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage">
        <section class="dy-business-dashboard-hero dy-direct-pay-hero">
          <div><span>PAGOS</span><h1>¿Cómo quieres cobrar?</h1><p>${h(b.name||'Tu negocio')} puede recibir pagos al retirar, al entregar o por transferencia. Para pagos online, estamos preparando Mercado Pago Split 1:1; vincular la cuenta no activa todavía los cobros reales.</p></div>
          <div class="dy-direct-pay-badge"><span>💳</span><div><b>Mercado Pago Split 1:1</b><small>Al pagar online, el comprador tendrá una tarifa DatoYa del 2% sobre productos. Mercado Pago aplica sus propias tarifas al negocio.</small></div></div>
        </section>

        <section class="dy-direct-pay-summary">
          <div><span>✅</span><strong>${paid}</strong><b>Pagos confirmados</b><small>Por tu negocio o por un proveedor conectado</small></div>
          <div><span>⏳</span><strong>${pending}</strong><b>Pagos pendientes</b><small>Verifica en tu banco antes de marcarlos pagados</small></div>
          <div><span>💸</span><strong>2%</strong><b>Tarifa DatoYa</b><small>Sobre productos, a cargo del comprador solo en el futuro pago online con Mercado Pago; no aplica a pagos directos.</small></div>
        </section>



        <section class="dy-business-card dy-direct-pay-settings">
          <div class="dy-card-head"><div><span>FÁCIL Y SIN CONFIGURACIONES</span><h2>¿Cómo quieres recibir los pagos?</h2><p>Activa los medios de pago directo que aceptarás. Mercado Pago se vincula en la sección superior y seguirá sin cobros reales hasta completar las pruebas.</p></div></div>
          <form id="dy-direct-pay-form">
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="pay_at_pickup" ${s.pay_at_pickup?'checked':''}><span>🛍️</span><div><b>Pago al retirar</b><small>El cliente paga directamente cuando retira.</small></div></label>
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="pay_on_delivery" ${s.pay_on_delivery?'checked':''}><span>🚚</span><div><b>Pago al recibir despacho</b><small>Para pedidos con despacho propio.</small></div></label>
            <label class="dy-direct-pay-toggle"><input type="checkbox" name="transfer_enabled" ${s.transfer_enabled?'checked':''}><span>🏦</span><div><b>Transferencia al negocio</b><small>Comparte tus datos bancarios con el cliente por un canal seguro y verifica el abono antes de marcar el pedido pagado.</small></div></label>
            <label class="dy-direct-pay-toggle"><input id="dy-external-pay-enabled" type="checkbox" name="external_payment_enabled" ${s.external_payment_enabled?'checked':''}><span>🔗</span><div><b>Ya tengo un enlace para cobrar</b><small>Opcional: si tu negocio ya dispone de un enlace de pago HTTPS.</small></div></label>
            <div class="field dy-direct-pay-url" id="dy-external-pay-url-wrap" ${s.external_payment_enabled?'':'hidden'}><label>Enlace de pago del negocio</label><input type="url" name="external_payment_url" value="${h(s.external_payment_url||'')}" placeholder="https://..." maxlength="500"><small>El dinero va a tu proveedor/cuenta, no a DatoYa.</small></div>
            <details class="dy-direct-pay-prepay"><summary>⚙️ Opción avanzada: exigir pago previo</summary><label class="dy-direct-pay-toggle warning"><input type="checkbox" name="prepayment_required" ${s.prepayment_required?'checked':''}><span>🛡️</span><div><b>Exigir pago antes de preparar</b><small>DatoYa bloqueará el estado “Preparando” hasta que marques el pago como recibido. No lo actives si tus clientes pagan al retirar o al recibir.</small></div></label></details>
            <p class="dy-direct-pay-tip">💡 Consejo: activa “Pago al retirar” para empezar sin configuraciones. Para transferencias, confirma siempre el dinero en tu banco antes de marcar un pedido como pagado.</p><button class="btn btn-primary btn-block" type="submit">Guardar y comenzar a recibir pedidos</button>
          </form>
        </section>

        <section class="dy-business-card">
          <div class="dy-card-head"><div><span>FLUJO RECOMENDADO</span><h2>Pedido seguro sin que DatoYa toque el dinero</h2></div></div>
          <div class="dy-direct-pay-flow"><div><span>1</span><b>Cliente pide</b><small>DatoYa registra el pedido.</small></div><i>→</i><div><span>2</span><b>Tú confirmas</b><small>Decides si aceptarlo.</small></div><i>→</i><div><span>3</span><b>Cliente te paga</b><small>Directamente a tu negocio.</small></div><i>→</i><div><span>4</span><b>Preparas</b><small>Si exiges prepago, solo después de marcar pagado.</small></div></div>
        </section>

        ${k.connected?`<details class="dy-direct-pay-advanced"><summary>⚙️ Administrar conexión anterior de Khipu</summary>
          <section class="dy-business-card dy-khipu-direct-card">
            <h2>Cuenta Khipu vinculada anteriormente</h2>
            <p>DatoYa está migrando los cobros online a Mercado Pago. Esta conexión anterior se conserva para revisar pagos existentes; no es necesaria para nuevos negocios.</p>
            <div class="dy-khipu-connected-box"><span>✓</span><div><b>Conexión anterior</b><small>ID de cobrador: ${h(k.receiver_id||'—')}</small></div></div>
            <details class="dy-khipu-update"><summary>Administrar credenciales anteriores</summary>${khipuForm}</details>
            <button class="btn btn-outline btn-block" type="button" id="dy-khipu-direct-disconnect">Desconectar Khipu</button>
          </section>
        </details>`:''}
        <section class="dy-direct-pay-note"><span>ℹ️</span><div><b>Mercado Pago será el medio de pago online</b><p>El Split 1:1 es para ventas a clientes. La compra y renovación de planes Impulso, Impulso+ y Premium tendrá un sistema de cobro separado que todavía está en preparación.</p></div></section>
      </div>`;
      document.getElementById('dy-khipu-direct-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const btn=e.currentTarget.querySelector('button[type="submit"]'),fd=new FormData(e.currentTarget);
        if(btn){btn.disabled=true;btn.textContent='Validando con Khipu…';}
        try{
          const result=await api('/businesses/'+id+'/khipu-direct',{method:'PUT',body:{
            receiver_id:String(fd.get('receiver_id')||'').trim(),
            secret:String(fd.get('secret')||'').trim(),
            api_key:String(fd.get('api_key')||'').trim()
          }});
          toast?.(result.message||'Khipu conectado','ok');
          renderDirectPayments(id);
        }catch(err){
          if(btn){btn.disabled=false;btn.textContent=k.connected?'Actualizar conexión Khipu':'Conectar Khipu';}
          toast?.(err.message||'No se pudo conectar Khipu','err');
        }
      });
      document.getElementById('dy-khipu-direct-disconnect')?.addEventListener('click',async e=>{
        if(!confirm('¿Desconectar Khipu de este negocio? Los pedidos nuevos ya no podrán pagarse con Khipu.'))return;
        const btn=e.currentTarget;btn.disabled=true;btn.textContent='Desconectando…';
        try{
          await api('/businesses/'+id+'/khipu-direct',{method:'DELETE'});
          toast?.('Khipu desconectado','ok');
          renderDirectPayments(id);
        }catch(err){btn.disabled=false;btn.textContent='Desconectar Khipu';toast?.(err.message||'No se pudo desconectar','err');}
      });
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
          if(btn){btn.disabled=false;btn.textContent='Guardar y comenzar a recibir pedidos';}
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
    if(s.transfer_enabled)parts.push('🏦 Transferencia al negocio');
    const k=data.khipu||{};
    if(k.available)parts.push('🏦 Khipu');
    if(s.external_payment_enabled&&s.external_payment_url)parts.push('🔗 Enlace de pago del negocio');
    const wa=String(data.order?.whatsapp||'').replace(/\D/g,'');
    const waHref=wa?'https://wa.me/'+wa+'?text='+encodeURIComponent('Hola, consulto por el pago de mi pedido '+String(o.reference||'')):'';
    const phone=String(data.order?.phone||'').replace(/[^+\d]/g,'');
    const telHref=!waHref&&phone?'tel:'+phone:'';
    return `<div class="dy-direct-customer-pay">
      <div><b>💳 Paga directamente a ${h(data.order?.business_name||o.business_name||'este negocio')}</b><p>${s.prepayment_required&&String(o.payment_status)!=='paid'?'Este negocio solicita pago antes de preparar el pedido.':'Coordina el pago con el negocio. DatoYa no recibe ese dinero.'}</p></div>
      <div class="dy-direct-customer-methods">${parts.map(x=>'<span>'+h(x)+'</span>').join('')}</div>
      <div class="dy-direct-customer-actions">
        ${k.available&&String(o.payment_status)!=='paid'?`<button class="btn btn-primary btn-sm" type="button" onclick="dyPayBusinessKhipu(${Number(o.id)},this)">Pagar con Khipu</button>`:''}
        ${s.external_payment_enabled&&s.external_payment_url&&String(o.payment_status)!=='paid'?`<a class="btn btn-outline btn-sm" href="${h(s.external_payment_url)}" target="_blank" rel="noopener noreferrer">Otro enlace de pago</a>`:''}
        ${waHref&&String(o.payment_status)!=='paid'?`<a class="btn btn-primary btn-sm" href="${h(waHref)}" target="_blank" rel="noopener noreferrer">Hablar con el negocio</a>`:''}
        ${telHref&&String(o.payment_status)!=='paid'?`<a class="btn btn-outline btn-sm" href="${h(telHref)}">Llamar al negocio</a>`:''}
      </div>
      ${String(o.payment_status)==='paid'?'<small class="paid">✅ Pago confirmado.</small>':'<small class="dy-direct-pay-reminder">Si transfieres, solicita los datos al negocio y conserva tu comprobante. El pedido se marca pagado tras su verificación.</small>'}
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
          const [data,khipu]=await Promise.all([
            api('/orders/'+Number(o.id)+'/direct-payment-options').catch(()=>null),
            api('/orders/'+Number(o.id)+'/business-khipu/status').catch(()=>({available:false,connected:false,paid:String(o.payment_status)==='paid'}))
          ]);if(!data)continue;
          data.khipu=khipu||{available:false};
          if(khipu&&khipu.paid)o.payment_status='paid';
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
        b.textContent='Formas de pago';
        if(small)small.textContent='Pago directo disponible · Mercado Pago en preparación';
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

  window.dyPayBusinessKhipu=async function(orderId,btn){
    if(btn?.disabled)return;
    const old=btn?.textContent||'Pagar con Khipu';
    if(btn){btn.disabled=true;btn.textContent='Abriendo Khipu…';}
    try{
      const r=await api('/orders/'+Number(orderId)+'/business-khipu/checkout',{method:'POST'});
      if(!r.payment_url)throw new Error('Khipu no devolvió el enlace de pago');
      location.href=r.payment_url;
    }catch(err){
      if(btn){btn.disabled=false;btn.textContent=old;}
      toast?.(err.message||'No se pudo iniciar el pago con Khipu','err');
    }
  };
  window.dyPayOrderKhipu=function(){toast?.('Este pedido se paga directamente al negocio. Usa Khipu del comercio si está conectado.','info');};
})();

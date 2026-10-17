/* DatoYa — Pagos de negocios: solo Mercado Pago gestionado por DatoYa.
   Historiales de operaciones anteriores se conservan en la base de datos.
   mp_split_ui.js añade la tarjeta OAuth oficial a esta página. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  async function renderCentralPayments(id){
    id=Number(id||0);
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    view.innerHTML='<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-direct-pay-loading"><span>💳</span><b>Cargando Mercado Pago…</b></section></div>';
    try{
      const [meta,ordersD]=await Promise.all([
        api('/businesses/'+id+'/manage'),
        api('/businesses/'+id+'/orders')
      ]);
      const business=meta.business||{},orders=ordersD.orders||[];
      const paid=orders.filter(o=>String(o.payment_status)==='paid').length;
      const pending=orders.filter(o=>String(o.payment_status)!=='paid'&&String(o.status)!=='cancelled').length;
      view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage">
        <section class="dy-business-dashboard-hero dy-direct-pay-hero">
          <div><span>PAGOS ONLINE</span><h1>Mercado Pago en DatoYa</h1>
            <p>Conecta tu cuenta para recibir pagos online por las compras de tus clientes.</p>
          </div>
        </section>
        <section class="dy-direct-pay-summary">
          <div><span>✅</span><strong>${paid}</strong><b>Pagos confirmados</b><small>Historial de pedidos del negocio</small></div>
          <div><span>⏳</span><strong>${pending}</strong><b>Pagos pendientes</b><small>Verifica tus pedidos en el panel</small></div>
        </section>
      </div>`;
      await window.__datoyaBusinessHubFrame?.(id,'payments');
      removeLegacyPaymentChoices();polishLabels();
    }catch(err){
      view.innerHTML='<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-direct-pay-loading error"><span>⚠️</span><h2>No pudimos cargar los pagos</h2><p>'+h(err.message||'Intenta nuevamente.')+'</p><button class="btn btn-primary" onclick="routes[\'mi-negocio-pagos\']('+id+')">Reintentar</button></section></div>';
      await window.__datoyaBusinessHubFrame?.(id,'payments');
    }
  }
  routes['mi-negocio-pagos']=renderCentralPayments;
  function removeLegacyPaymentChoices(){
    const triggers=['¿Cómo quieres recibir los pagos?','Pago al retirar','Pago al recibir despacho','Transferencia al negocio','Ya tengo un enlace para cobrar'];
    document.querySelectorAll(['.dy-direct-','pay-options,.dy-direct-pay-settings,[data-direct-payment-settings]'].join('')).forEach(el=>el.remove());
    document.querySelectorAll('h1,h2,h3').forEach(el=>{
      if(triggers.some(s=>String(el.textContent||'').includes(s))){
        const section=el.closest('section,.dy-business-card,.dy-payment-options');
        if(section&&section.querySelectorAll('h1,h2,h3').length<4)section.remove();
      }
    });
  }
  function polishLabels(){
    document.querySelectorAll('.dy-dashboard-growth a[href*="mi-negocio-pagos"]').forEach(a=>{
      const b=a.querySelector('b'),small=a.querySelector('small'),icon=a.querySelector('span');
      if(icon)icon.textContent='💳';
      if(b)b.textContent='Mercado Pago';
      if(small)small.textContent='Pagos online desde DatoYa';
    });
    document.querySelectorAll('.dy-dashboard-checks>div').forEach(x=>{
      const b=x.querySelector('b'),small=x.querySelector('small'),icon=x.querySelector('span');
      if(b&&['Khipu','Formas de pago'].includes(b.textContent.trim())){
        if(icon)icon.textContent='💳';
        b.textContent='Mercado Pago';
        if(small)small.textContent='Vincula tu cuenta para cobrar online';
      }
    });
  }
  const old=routes['mi-negocio'];
  if(old)routes['mi-negocio']=async function(id){const v=await old.apply(this,arguments);removeLegacyPaymentChoices();polishLabels();return v;};
  const oldConfig=routes['mi-negocio-configuracion'];
  if(oldConfig)routes['mi-negocio-configuracion']=async function(id){const v=await oldConfig.apply(this,arguments);polishLabels();return v;};
  window.dyPayBusinessKhipu=()=>toast?.('Los pagos de clientes se harán mediante DatoYa y Mercado Pago.','info');
  window.dyPayOrderKhipu=()=>toast?.('Los pagos de clientes se harán mediante DatoYa y Mercado Pago.','info');
})();
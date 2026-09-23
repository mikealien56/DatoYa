/* DatoYa — Khipu TEST para pedidos del marketplace. */
(() => {
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const previousOrders=routes.pedidos;
  if(!previousOrders)return;

  routes.pedidos=async function(){
    await previousOrders.apply(this,arguments);
    if(!ME)return;
    try{
      const {orders=[]}=await api('/orders/mine');
      const cards=[...document.querySelectorAll('.dy-order-card')];
      let needsRefresh=false;
      await Promise.all(orders.map(async(o,index)=>{
        if(o.status==='cancelled'||o.status==='completed')return;
        const s=await api('/orders/'+o.id+'/khipu/status').catch(()=>null);
        if(!s)return;
        if(s.paid&&o.payment_status!=='paid'){needsRefresh=true;return;}
        if(o.payment_status==='paid'||!s.available)return;
        const card=cards[index];if(!card)return;
        const area=card.querySelector('.dy-order-actions')||card;
        if(area.querySelector('[data-khipu-pay]'))return;
        const note=document.createElement('div');
        note.className='dy-commerce-note dy-khipu-test-note';
        note.innerHTML='<b>🧪 Khipu desarrollo</b><p>Pago ficticio con cuenta de desarrollo. No mueve dinero real.'+(s.integrator_enabled?' Split integrador activo.':' El split automático se activará cuando Khipu habilite la cuenta integradora.')+'</p>';
        area.appendChild(note);
        const btn=document.createElement('button');
        btn.className='btn btn-primary btn-sm';
        btn.type='button';
        btn.dataset.khipuPay='1';
        btn.textContent='🏦 Pagar TEST con Khipu';
        btn.onclick=()=>window.dyPayOrderKhipu(o.id,btn);
        area.appendChild(btn);
      }));
      if(needsRefresh)await previousOrders.apply(this,arguments);
    }catch(_){}
  };

  window.dyPayOrderKhipu=async function(id,button){
    const btn=button||null;
    if(btn){btn.disabled=true;btn.textContent='Abriendo Khipu TEST…';}
    try{
      const r=await api('/orders/'+id+'/khipu/checkout',{method:'POST'});
      if(!r.payment_url)throw new Error('Khipu no devolvió un enlace de pago');
      location.href=r.payment_url;
    }catch(err){
      if(btn){btn.disabled=false;btn.textContent='🏦 Pagar TEST con Khipu';}
      toast?.(err.message||'No se pudo abrir Khipu','err');
    }
  };
  // En una carga directa a #/pedidos, app.js puede ejecutar route() antes de que
  // las rutas del marketplace terminen de registrarse. Re-resuelve una sola vez.
  if(!window.dyKhipuDeepLinkReady){
    window.dyKhipuDeepLinkReady=true;
    const bootPath=location.hash.replace(/^#\//,'').split('/')[0];
    if(bootPath==='pedidos')setTimeout(()=>{if(typeof route==='function'&&routes.pedidos)route();},50);
  }
})();
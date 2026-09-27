/* DatoYa — UI de devoluciones y reembolsos. */
(() => {
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const labels={requested:'Solicitud enviada',approved:'Aprobada',rejected:'Rechazada',escalated:'En revisión por DatoYa',processing:'Procesando reembolso',refunded:'Devuelta',cancelled:'Cancelada'};
  const reasons={cancel_order:'Quiero cancelar el pedido',not_received:'No recibí el pedido',wrong_item:'Producto incorrecto',damaged:'Producto dañado',quality:'Problema de calidad',other:'Otro motivo'};
  const active=s=>['requested','approved','escalated','processing'].includes(String(s));

  function refundBox(r,side){
    if(!r)return '';
    const status=labels[r.status]||r.status,amount=Number(r.refunded_amount||r.approved_amount||r.requested_amount||0);
    const notes=[r.reason_text?'<p><b>Detalle:</b> '+h(r.reason_text)+'</p>':'',r.business_note?'<p><b>Respuesta del negocio:</b> '+h(r.business_note)+'</p>':'',r.admin_note?'<p><b>Nota DatoYa:</b> '+h(r.admin_note)+'</p>':''].join('');
    let actions='';
    if(side==='customer'){
      if(r.status==='requested')actions='<button class="btn btn-outline btn-sm" onclick="dyRefundCancel('+r.id+')">Cancelar solicitud</button>';
      if(['rejected','approved'].includes(r.status))actions='<button class="btn btn-outline btn-sm" onclick="dyRefundEscalate('+r.id+')">Pedir revisión a DatoYa</button>';
    }
    if(side==='business'){
      if(r.status==='requested')actions='<button class="btn btn-primary btn-sm" onclick="dyRefundApprove('+r.business_id+','+r.id+','+Number(r.requested_amount)+')">Aprobar</button><button class="btn btn-outline btn-sm" onclick="dyRefundPartial('+r.business_id+','+r.id+','+Number(r.requested_amount)+')">Aprobar parcial</button><button class="btn btn-outline btn-sm" onclick="dyRefundReject('+r.business_id+','+r.id+')">Rechazar</button><button class="btn btn-outline btn-sm" onclick="dyRefundBusinessEscalate('+r.business_id+','+r.id+')">Escalar a DatoYa</button>';
      if(r.status==='approved')actions='<button class="btn btn-primary btn-sm" onclick="dyRefundConfirmExternal('+r.business_id+','+r.id+')">Confirmar devolución realizada</button>';
    }
    return '<div class="dy-refund-box '+h(r.status)+'"><div class="dy-refund-head"><div><small>'+h(r.reference)+'</small><b>'+h(status)+'</b></div><strong>'+money(amount)+'</strong></div><p><b>Motivo:</b> '+h(reasons[r.reason_code]||r.reason_code)+'</p>'+notes+(r.status==='refunded'?'<p class="dy-refund-ok">✓ Devolución registrada · comisión DatoYa revertida: '+money(r.commission_refund_amount||0)+'</p>':'')+(actions?'<div class="dy-refund-actions">'+actions+'</div>':'')+'</div>';
  }

  function showRequestModal(order){
    const remaining=Math.max(0,Number(order.total||0)-Number(order.refunded_total||0));
    const html='<h3>Solicitar devolución</h3><p>Pedido <b>'+h(order.reference)+'</b></p><form id="dy-refund-request-form"><div class="field"><label>Motivo</label><select name="reason"><option value="cancel_order">Quiero cancelar el pedido</option><option value="not_received">No recibí el pedido</option><option value="wrong_item">Producto incorrecto</option><option value="damaged">Producto dañado</option><option value="quality">Problema de calidad</option><option value="other">Otro motivo</option></select></div><div class="field"><label>Monto solicitado</label><input name="amount" type="number" min="1" max="'+remaining+'" value="'+remaining+'" required></div><div class="field"><label>Cuéntale al negocio qué pasó</label><textarea name="details" rows="4" maxlength="1200" placeholder="Explica brevemente el problema"></textarea></div><div class="dy-refund-note">La solicitud va primero al negocio. DatoYa interviene solo si necesitas escalar el caso.</div><button class="btn btn-primary btn-block">Enviar solicitud</button></form>';
    if(typeof openModal==='function')openModal(html);else return;
    setTimeout(()=>{const f=document.getElementById('dy-refund-request-form');if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();const btn=f.querySelector('button[type=submit]');btn.disabled=true;try{await api('/orders/'+order.id+'/refunds',{method:'POST',body:{reason:f.reason.value,amount:Number(f.amount.value),details:f.details.value}});closeModal?.();toast?.('Solicitud enviada al negocio','ok');routes.pedidos(order.id);}catch(err){btn.disabled=false;toast?.(err.message,'err')}};},0);
  }
  window.dyRequestRefund=id=>{const o=(window.__dyRefundOrders||[]).find(x=>Number(x.id)===Number(id));if(o)showRequestModal(o)};
  window.dyRefundCancel=async id=>{if(!confirm('¿Cancelar esta solicitud de devolución?'))return;try{await api('/orders/refunds/'+id+'/cancel',{method:'POST'});toast?.('Solicitud cancelada','ok');routes.pedidos()}catch(e){toast?.(e.message,'err')}};
  window.dyRefundEscalate=async id=>{const note=prompt('¿Qué necesita revisar DatoYa?','')||'';try{await api('/orders/refunds/'+id+'/escalate',{method:'POST',body:{note}});toast?.('Caso enviado a DatoYa','ok');routes.pedidos()}catch(e){toast?.(e.message,'err')}};

  async function decorateCustomerRefunds(){
    try{
      const [{orders=[]},{refunds=[]}]=await Promise.all([api('/orders/mine'),api('/orders/refunds/mine')]);
      const refundedByOrder=new Map();for(const r of refunds)if(String(r.status)==='refunded')refundedByOrder.set(Number(r.order_id),(refundedByOrder.get(Number(r.order_id))||0)+Number(r.refunded_amount||0));
      for(const o of orders)o.refunded_total=refundedByOrder.get(Number(o.id))||0;
      window.__dyRefundOrders=orders;
      const byOrder=new Map();for(const r of refunds)if(!byOrder.has(Number(r.order_id)))byOrder.set(Number(r.order_id),r);
      for(const o of orders){
        const card=document.getElementById('dy-order-'+Number(o.id));if(!card)continue;
        card.querySelectorAll('.dy-refund-box,.dy-refund-start').forEach(n=>n.remove());
        const r=byOrder.get(Number(o.id));
        if(r)card.insertAdjacentHTML('beforeend',refundBox(r,'customer'));
        const refundable=['paid','partially_refunded'].includes(String(o.payment_status));
        if(refundable&&(!r||!active(r.status))){
          card.insertAdjacentHTML('beforeend','<div class="dy-refund-start"><button class="btn btn-outline btn-sm" onclick="dyRequestRefund('+Number(o.id)+')">Solicitar devolución</button><small>La solicitud se envía primero al negocio.</small></div>');
        }
      }
    }catch(_){}
  }
  function scheduleCustomerRefundDecoration(){
    [120,500,1200].forEach(ms=>setTimeout(()=>{if(String(location.hash||'').startsWith('#/pedidos'))decorateCustomerRefunds();},ms));
  }
  const previousOrders=routes.pedidos;
  if(previousOrders)routes.pedidos=async function(){
    await previousOrders.apply(this,arguments);
    await decorateCustomerRefunds();
    scheduleCustomerRefundDecoration();
  };
  if(String(location.hash||'').startsWith('#/pedidos'))scheduleCustomerRefundDecoration();
  window.addEventListener('hashchange',()=>{if(String(location.hash||'').startsWith('#/pedidos'))scheduleCustomerRefundDecoration();});

  function askNote(title,def=''){return prompt(title,def)||''}
  window.dyRefundApprove=async(bid,id,amount)=>{if(!confirm('¿Aprobar devolución por '+money(amount)+'?'))return;try{const r=await api('/businesses/'+bid+'/refunds/'+id+'/decision',{method:'POST',body:{action:'approve',amount}});toast?.(r.executed?'Devolución completada en modo de desarrollo':'Devolución aprobada','ok');routes['mi-negocio-pedidos'](bid)}catch(e){toast?.(e.message,'err')}};
  window.dyRefundPartial=async(bid,id,max)=>{const amount=Math.round(Number(prompt('Monto a devolver (máximo '+money(max)+')',String(max))||0));if(!amount)return;const note=askNote('Explica la propuesta de devolución parcial');try{await api('/businesses/'+bid+'/refunds/'+id+'/decision',{method:'POST',body:{action:'approve',amount,note}});toast?.('Devolución parcial aprobada','ok');routes['mi-negocio-pedidos'](bid)}catch(e){toast?.(e.message,'err')}};
  window.dyRefundReject=async(bid,id)=>{const note=askNote('Explica brevemente por qué rechazas la devolución');if(note.length<3)return;try{await api('/businesses/'+bid+'/refunds/'+id+'/decision',{method:'POST',body:{action:'reject',note}});toast?.('Respuesta enviada al cliente','ok');routes['mi-negocio-pedidos'](bid)}catch(e){toast?.(e.message,'err')}};
  window.dyRefundBusinessEscalate=async(bid,id)=>{const note=askNote('¿Qué necesita revisar DatoYa?');try{await api('/businesses/'+bid+'/refunds/'+id+'/decision',{method:'POST',body:{action:'escalate',note}});toast?.('Caso escalado a DatoYa','ok');routes['mi-negocio-pedidos'](bid)}catch(e){toast?.(e.message,'err')}};
  window.dyRefundConfirmExternal=async(bid,id)=>{if(!confirm('Confirma esto solo si el dinero ya fue devuelto al cliente.'))return;const note=askNote('Referencia o nota de la devolución (opcional)');try{await api('/businesses/'+bid+'/refunds/'+id+'/confirm-external',{method:'POST',body:{note}});toast?.('Devolución registrada','ok');routes['mi-negocio-pedidos'](bid)}catch(e){toast?.(e.message,'err')}};

  async function decorateBusinessRefunds(bid){
    if(!bid)return;
    try{
      const [{orders=[]},{refunds=[]}]=await Promise.all([api('/businesses/'+bid+'/orders'),api('/businesses/'+bid+'/refunds')]);
      const byOrder=new Map();for(const r of refunds)if(!byOrder.has(Number(r.order_id)))byOrder.set(Number(r.order_id),r);
      for(const o of orders){
        const card=document.querySelector('.dy-order-card[data-order-id="'+Number(o.id)+'"]');if(!card)continue;
        card.querySelectorAll('.dy-refund-box').forEach(n=>n.remove());
        const r=byOrder.get(Number(o.id));if(r)card.insertAdjacentHTML('beforeend',refundBox(r,'business'));
      }
    }catch(_){}
  }
  function scheduleBusinessRefundDecoration(bid){
    [120,500,1200].forEach(ms=>setTimeout(()=>decorateBusinessRefunds(Number(bid)),ms));
  }
  const prevBusinessOrders=routes['mi-negocio-pedidos'];
  if(prevBusinessOrders)routes['mi-negocio-pedidos']=async function(id){
    await prevBusinessOrders.apply(this,arguments);
    const bid=Number(id);if(!bid)return;
    await decorateBusinessRefunds(bid);
    scheduleBusinessRefundDecoration(bid);
  };

  const previousAdmin=routes.admin;
  if(previousAdmin)routes.admin=async function(tab='dashboard'){
    if(!ME||ME.role!=='admin')return previousAdmin.apply(this,arguments);
    if(tab==='devoluciones')return renderAdminRefunds();
    await previousAdmin.apply(this,arguments);
    if(['dashboard','resumen',''].includes(tab||'')){
      const root=document.querySelector('.dy-admin-market');
      if(root&&!document.getElementById('dy-refunds-admin-link'))root.insertAdjacentHTML('beforeend','<section id="dy-refunds-admin-link" class="dy-admin-section"><h2>Devoluciones</h2><div class="dy-admin-grid"><a href="#/admin/devoluciones"><b>↩️ Devoluciones y reclamos</b><span>Interviene solo en casos escalados o que necesiten revisión.</span></a></div></section>');
    }
  };
  async function renderAdminRefunds(){
    const {refunds=[],stats={}}=await api('/admin/refunds');
    view.innerHTML='<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>↩️ Devoluciones</h1><p>Seguimiento de devoluciones; prioriza los casos escalados.</p></div><span>'+Number(stats.escalated||0)+' escalados</span></div><div class="dy-refund-stats"><span><b>'+Number(stats.pending||0)+'</b>Pendientes</span><span><b>'+money(stats.refunded_amount||0)+'</b>Devuelto</span><span><b>'+money(stats.commission_reversed||0)+'</b>Comisión revertida</span></div><div class="dy-admin-list">'+(refunds.length?refunds.map(r=>'<article class="dy-admin-business"><div class="dy-admin-business-main"><div><small>'+h(r.reference)+' · '+h(r.order_reference)+'</small><h3>'+h(r.business_name)+'</h3><p>'+h(r.customer_name)+' · '+h(labels[r.status]||r.status)+'</p><div class="dy-admin-tags"><span>Solicita '+money(r.requested_amount)+'</span>'+(r.approved_amount?'<span>Aprobado '+money(r.approved_amount)+'</span>':'')+'<span>'+h(reasons[r.reason_code]||r.reason_code)+'</span></div></div><strong>'+money(r.refunded_amount||r.approved_amount||r.requested_amount)+'</strong></div>'+refundBox(r,'admin')+(r.status==='escalated'?'<div class="dy-admin-actions"><button class="btn btn-primary btn-sm" onclick="dyAdminRefundApprove('+r.id+','+r.requested_amount+')">Aprobar</button><button class="btn btn-outline btn-sm" onclick="dyAdminRefundReject('+r.id+')">Rechazar</button><button class="btn btn-outline btn-sm" onclick="dyAdminRefundMark('+r.id+','+(r.approved_amount||r.requested_amount)+')">Marcar devuelto</button></div>':'')+'</article>').join(''):'<div class="empty">No hay solicitudes de devolución.</div>')+'</div></div>';
  }
  window.dyAdminRefundApprove=async(id,amount)=>{const note=askNote('Nota de resolución DatoYa');try{await api('/admin/refunds/'+id+'/resolve',{method:'POST',body:{action:'approve',amount,note}});toast?.('Resolución guardada','ok');renderAdminRefunds()}catch(e){toast?.(e.message,'err')}};
  window.dyAdminRefundReject=async id=>{const note=askNote('Motivo del rechazo');try{await api('/admin/refunds/'+id+'/resolve',{method:'POST',body:{action:'reject',note}});toast?.('Resolución guardada','ok');renderAdminRefunds()}catch(e){toast?.(e.message,'err')}};
  window.dyAdminRefundMark=async(id,amount)=>{if(!confirm('Confirma solo si la devolución fue efectivamente realizada.'))return;const note=askNote('Referencia o nota de confirmación');try{await api('/admin/refunds/'+id+'/resolve',{method:'POST',body:{action:'mark_refunded',amount,note}});toast?.('Devolución confirmada','ok');renderAdminRefunds()}catch(e){toast?.(e.message,'err')}};
})();

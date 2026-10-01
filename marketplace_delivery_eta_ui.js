/* DatoYa — despacho propio + ETA + seguimiento en vivo. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function'||typeof view==='undefined')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const clock=v=>{try{return new Date(v).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false})}catch(_){return ''}};
  const remaining=v=>{const n=Math.ceil((new Date(v).getTime()-Date.now())/60000);return Number.isFinite(n)?(n>1?n+' min':n>=0?'muy pronto':'hora estimada superada'):''};
  const common=[15,20,30,45,60,90,120];
  const etaOptions=def=>{
    const values=[...new Set([...common,Number(def||30)])].filter(x=>x>=5&&x<=240).sort((a,b)=>a-b);
    return values.map(x=>'<option value="'+x+'" '+(x===Number(def)?'selected':'')+'>'+x+' min'+(x===Number(def)?' · habitual':'')+'</option>').join('')+'<option value="custom">Otro tiempo…</option>';
  };
  function etaValue(id,kind,def){
    const s=document.getElementById('dy-'+kind+'-eta-'+id),custom=document.getElementById('dy-'+kind+'-eta-custom-'+id);
    if(!s)return Number(def||30);
    const n=s.value==='custom'?Number(custom?.value||def||30):Number(s.value);
    return Math.max(5,Math.min(240,Math.round(n||def||30)));
  }
  window.dyEtaToggleCustom=(id,kind)=>{
    const s=document.getElementById('dy-'+kind+'-eta-'+id),c=document.getElementById('dy-'+kind+'-eta-custom-'+id);
    if(c)c.hidden=s?.value!=='custom';
  };

  async function addDeliverySettings(id){
    if(document.getElementById('dy-own-delivery-settings'))return;
    const root=document.querySelector('.dy-business-dashboard')||document.querySelector('.dy-business-page');if(!root)return;
    try{
      const [{delivery:d},{timing:t}]=await Promise.all([api('/businesses/'+id+'/delivery'),api('/businesses/'+id+'/delivery-timing')]);
      const section=document.createElement('section');section.id='dy-own-delivery-settings';section.className='dy-business-card dy-own-delivery-settings';
      section.innerHTML='<div class="dy-card-head"><div><span>DESPACHO PROPIO</span><h2>🚚 Entregas hechas por tu negocio</h2><p>DatoYa calcula el despacho y lo suma al total. Tú haces la entrega con tu propio reparto.</p></div><span class="dy-delivery-state '+(d.enabled?'on':'')+'">'+(d.enabled?'Activo':'Desactivado')+'</span></div>'+
        '<form id="dy-own-delivery-form">'+
          '<label class="dy-delivery-master"><input type="checkbox" name="enabled" '+(d.enabled?'checked':'')+'><span><b>Mi negocio ofrece despacho propio</b><small>Los clientes podrán elegir despacho si cumplen tus condiciones.</small></span></label>'+
          '<div class="dy-delivery-settings-grid">'+
            '<div class="field"><label>Tarifa de despacho</label><input name="fee" type="number" min="0" max="200000" step="100" value="'+Number(d.fee||0)+'"><small>Se suma automáticamente al pedido.</small></div>'+
            '<div class="field"><label>Pedido mínimo</label><input name="min_order" type="number" min="0" max="1000000" step="100" value="'+Number(d.min_order||0)+'"><small>0 = sin mínimo.</small></div>'+
            '<div class="field"><label>Despacho gratis desde</label><input name="free_from" type="number" min="0" max="2000000" step="100" value="'+(d.free_from==null?'':Number(d.free_from))+'" placeholder="Opcional"></div>'+
            '<div class="field"><label>Radio máximo</label><input name="radius_km" type="number" min=".5" max="100" step=".5" value="'+Number(d.radius_km||5)+'"><small>DatoYa valida distancia cuando es posible.</small></div>'+
          '</div>'+
          '<div class="dy-delivery-time-title"><b>⏱️ Tiempos habituales</b><p>Se usarán como sugerencia al confirmar cada pedido. Siempre puedes cambiarlos.</p></div>'+
          '<div class="dy-delivery-settings-grid timing">'+
            '<div class="field"><label>Retiro listo en</label><select name="pickup_prep_minutes">'+etaOptions(t.pickup_prep_minutes)+'</select></div>'+
            '<div class="field"><label>Despacho listo en</label><select name="delivery_prep_minutes">'+etaOptions(t.delivery_prep_minutes)+'</select></div>'+
            '<div class="field"><label>Reparto demora aprox.</label><select name="delivery_travel_minutes">'+etaOptions(t.delivery_travel_minutes)+'</select></div>'+
          '</div>'+
          '<div class="dy-delivery-total-example"><span>Ejemplo</span><div><small>Productos</small><b>$20.000</b></div><div><small>Despacho</small><b>'+money(d.fee||0)+'</b></div><div><small>Total cliente</small><strong>'+money(20000+Number(d.fee||0))+'</strong></div></div>'+
          '<button class="btn btn-primary" type="submit">Guardar despacho propio</button>'+
        '</form>';
      root.appendChild(section);
      const f=section.querySelector('form');
      f.addEventListener('submit',async e=>{
        e.preventDefault();const btn=f.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Guardando…';
        try{
          await api('/businesses/'+id+'/delivery',{method:'PUT',body:{enabled:!!f.enabled.checked,fee:Number(f.fee.value||0),min_order:Number(f.min_order.value||0),free_from:f.free_from.value===''?null:Number(f.free_from.value),radius_km:Number(f.radius_km.value||5)}});
          await api('/businesses/'+id+'/delivery-timing',{method:'PUT',body:{pickup_prep_minutes:Number(f.pickup_prep_minutes.value),delivery_prep_minutes:Number(f.delivery_prep_minutes.value),delivery_travel_minutes:Number(f.delivery_travel_minutes.value)}});
          toast?.('Despacho propio actualizado','ok');routes['mi-negocio'](id);
        }catch(err){btn.disabled=false;btn.textContent='Guardar despacho propio';toast?.(err.message||'No pudimos guardar','err');}
      });
    }catch(_){}
  }

  const prevBusiness=routes['mi-negocio'];
  if(prevBusiness)routes['mi-negocio']=async function(id){
    const r=await prevBusiness.apply(this,arguments);
    const businessId=Number(id||0);if(businessId)setTimeout(()=>addDeliverySettings(businessId),0);
    return r;
  };

  function merchantEtaBlock(o,timing){
    if(['completed','cancelled'].includes(String(o.status)))return '';
    const prepDef=o.fulfillment_method==='delivery'?Number(timing.delivery_prep_minutes||45):Number(timing.pickup_prep_minutes||30);
    let html='<div class="dy-order-eta-merchant">';
    if(o.status==='new'){
      html+='<div><b>⏱️ Al confirmar, avisa cuánto demorará</b><small>'+(o.fulfillment_method==='delivery'?'Tiempo hasta dejarlo listo para despacho.':'Tiempo hasta dejarlo listo para retiro.')+'</small></div>'+
        '<div class="dy-eta-controls"><select id="dy-prep-eta-'+o.id+'" onchange="dyEtaToggleCustom('+o.id+',\'prep\')">'+etaOptions(prepDef)+'</select><input hidden id="dy-prep-eta-custom-'+o.id+'" type="number" min="5" max="240" value="'+prepDef+'" placeholder="Minutos"></div>';
    }else if(['confirmed','preparing'].includes(String(o.status))){
      html+='<div><b>⏱️ '+(o.estimated_ready_at?'Estimado para las '+h(clock(o.estimated_ready_at)):'Sin hora estimada')+'</b><small>'+(o.estimated_ready_at?h(remaining(o.estimated_ready_at)):'Puedes avisar un tiempo al cliente.')+'</small></div>'+
        '<div class="dy-eta-controls"><select id="dy-prep-eta-'+o.id+'" onchange="dyEtaToggleCustom('+o.id+',\'prep\')">'+etaOptions(prepDef)+'</select><input hidden id="dy-prep-eta-custom-'+o.id+'" type="number" min="5" max="240" value="'+prepDef+'"><button class="btn btn-outline btn-sm" type="button" onclick="dyUpdateEta('+o.business_id+','+o.id+',\'prep\',this)">Actualizar tiempo</button></div>';
    }else if(o.fulfillment_method==='delivery'&&o.status==='ready'){
      const travel=Number(timing.delivery_travel_minutes||30);
      if(String(o.delivery_stage)==='out_for_delivery'){
        html+='<div class="dy-delivery-live"><span>🚚</span><div><b>Pedido en reparto</b><small>'+(o.estimated_delivery_at?'Llegada aprox. '+h(clock(o.estimated_delivery_at))+' · '+h(remaining(o.estimated_delivery_at)):'Sin hora de llegada')+'</small></div></div>'+
          '<div class="dy-eta-controls"><select id="dy-arrival-eta-'+o.id+'" onchange="dyEtaToggleCustom('+o.id+',\'arrival\')">'+etaOptions(travel)+'</select><input hidden id="dy-arrival-eta-custom-'+o.id+'" type="number" min="5" max="240" value="'+travel+'"><button class="btn btn-outline btn-sm" type="button" onclick="dyUpdateEta('+o.business_id+','+o.id+',\'arrival\',this)">Actualizar llegada</button></div>';
      }else{
        html+='<div><b>📦 Listo para despacho</b><small>Cuando el repartidor salga, avisa al cliente y define la llegada estimada.</small></div>'+
          '<div class="dy-eta-controls"><select id="dy-arrival-eta-'+o.id+'" onchange="dyEtaToggleCustom('+o.id+',\'arrival\')">'+etaOptions(travel)+'</select><input hidden id="dy-arrival-eta-custom-'+o.id+'" type="number" min="5" max="240" value="'+travel+'"><button class="btn btn-primary btn-sm" type="button" onclick="dyOutForDelivery('+o.business_id+','+o.id+',this)">🚚 Salió a reparto</button></div>';
      }
    }
    html+='</div>';return html;
  }

  async function enhanceMerchantOrders(id){
    try{
      const [{orders=[]},{timing}]=await Promise.all([api('/businesses/'+id+'/orders'),api('/businesses/'+id+'/delivery-timing')]);
      for(const o of orders){
        o.business_id=Number(id);
        const card=document.querySelector('[data-order-id="'+Number(o.id)+'"]');if(!card)continue;
        if(!card.querySelector('.dy-order-cost-breakdown')){
          const meta=card.querySelector('.dy-order-meta');
          const cost=document.createElement('div');cost.className='dy-order-cost-breakdown';
          cost.innerHTML='<span>Productos <b>'+money(o.subtotal)+'</b></span>'+(o.fulfillment_method==='delivery'?'<span>Despacho <b>'+money(o.delivery_fee)+'</b></span>':'')+'<span>Total <strong>'+money(o.total)+'</strong></span>';
          meta?.insertAdjacentElement('afterend',cost);
        }
        if(!card.querySelector('.dy-order-eta-merchant')){
          const actions=card.querySelector('.dy-order-actions');
          actions?.insertAdjacentHTML('beforebegin',merchantEtaBlock(o,timing||{}));
        }
        const advance=[...card.querySelectorAll('button[onclick*="dyMerchantOrderStatus"]')];
        for(const btn of advance){
          const raw=String(btn.getAttribute('onclick')||''),m=raw.match(/dyMerchantOrderStatus\((\d+),(\d+),'(confirmed|preparing|ready)'/);if(!m)continue;
          btn.setAttribute('onclick',"dyAdvanceOrder("+Number(m[1])+","+Number(m[2])+",'"+m[3]+"',this)");
          if(m[3]==='confirmed')btn.textContent='Confirmar y avisar tiempo';
        }
      }
    }catch(_){}
  }

  const prevMerchantOrders=routes['mi-negocio-pedidos'];
  if(prevMerchantOrders)routes['mi-negocio-pedidos']=async function(id){
    const r=await prevMerchantOrders.apply(this,arguments);
    const bid=Number(id||0);if(bid)setTimeout(()=>enhanceMerchantOrders(bid),0);
    return r;
  };

  window.dyAdvanceOrder=async(bid,id,status,btn)=>{
    if(btn?.disabled)return;btn&&(btn.disabled=true);
    try{
      const body={status};
      if(status==='confirmed')body.eta_minutes=etaValue(id,'prep',30);
      await api('/businesses/'+bid+'/orders/'+id+'/advance',{method:'PUT',body});
      toast?.(status==='confirmed'?'Pedido confirmado y cliente avisado':status==='preparing'?'Pedido en preparación':'Pedido marcado listo','ok');
      routes['mi-negocio-pedidos'](bid);
    }catch(err){if(btn)btn.disabled=false;toast?.(err.message,'err');}
  };
  window.dyUpdateEta=async(bid,id,mode,btn)=>{
    if(btn?.disabled)return;btn&&(btn.disabled=true);
    try{
      await api('/businesses/'+bid+'/orders/'+id+'/estimate',{method:'PUT',body:{mode,eta_minutes:etaValue(id,mode,30)}});
      toast?.('Nuevo tiempo enviado al cliente','ok');routes['mi-negocio-pedidos'](bid);
    }catch(err){if(btn)btn.disabled=false;toast?.(err.message,'err');}
  };
  window.dyOutForDelivery=async(bid,id,btn)=>{
    if(btn?.disabled)return;btn&&(btn.disabled=true);
    try{
      await api('/businesses/'+bid+'/orders/'+id+'/out-for-delivery',{method:'PUT',body:{eta_minutes:etaValue(id,'arrival',30)}});
      toast?.('Cliente avisado: pedido salió a reparto','ok');routes['mi-negocio-pedidos'](bid);
    }catch(err){if(btn)btn.disabled=false;toast?.(err.message,'err');}
  };

  function customerEta(o){
    if(o.status==='new')return '<div class="dy-customer-eta waiting"><span>⏳</span><div><b>Esperando confirmación del negocio</b><small>Cuando lo acepte, verás aquí el tiempo estimado.</small></div></div>';
    if(['confirmed','preparing'].includes(String(o.status))&&o.estimated_ready_at){
      return '<div class="dy-customer-eta"><span>⏱️</span><div><b>'+(o.fulfillment_method==='delivery'?'Listo para despacho':'Listo para retirar')+' aprox. a las '+h(clock(o.estimated_ready_at))+'</b><small>'+h(remaining(o.estimated_ready_at))+(o.status==='preparing'?' · en preparación':'')+'</small></div></div>';
    }
    if(o.fulfillment_method==='delivery'&&o.status==='ready'&&String(o.delivery_stage)==='out_for_delivery'){
      return '<div class="dy-customer-eta live"><span>🚚</span><div><b>Tu pedido va en camino</b><small>'+(o.estimated_delivery_at?'Llegada aprox. '+h(clock(o.estimated_delivery_at))+' · '+h(remaining(o.estimated_delivery_at)):'El negocio ya inició el reparto.')+'</small></div></div>';
    }
    if(o.fulfillment_method==='delivery'&&o.status==='ready')return '<div class="dy-customer-eta ready"><span>📦</span><div><b>Tu pedido está listo para salir a reparto</b><small>Te avisaremos cuando el repartidor salga.</small></div></div>';
    if(o.fulfillment_method==='pickup'&&o.status==='ready')return '<div class="dy-customer-eta ready"><span>✅</span><div><b>Tu pedido está listo para retirar</b><small>Ya puedes ir al negocio. Lleva tu QR o código.</small></div></div>';
    if(o.status==='completed')return '<div class="dy-customer-eta done"><span>✅</span><div><b>'+(o.fulfillment_method==='delivery'?'Pedido entregado':'Pedido retirado')+'</b><small>Pedido completado.</small></div></div>';
    return '';
  }

  async function enhanceCustomerOrders(){
    try{
      const {orders=[]}=await api('/orders/mine');
      for(const o of orders){
        const card=document.getElementById('dy-order-'+Number(o.id));if(!card||card.querySelector('.dy-customer-eta'))continue;
        const meta=card.querySelector('.dy-order-meta');
        const html=customerEta(o);if(html)meta?.insertAdjacentHTML('beforebegin',html);
      }
    }catch(_){}
  }
  const prevOrders=routes.pedidos;
  if(prevOrders)routes.pedidos=async function(){
    const r=await prevOrders.apply(this,arguments);
    setTimeout(enhanceCustomerOrders,0);
    return r;
  };
})();
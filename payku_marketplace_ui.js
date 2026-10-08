/* Payku Marketplace interface for DatoYa. Loaded after direct merchant payments UI. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  function el(tag,attrs,content){
    const e=document.createElement(tag);
    for(const [name,value] of Object.entries(attrs||{}))e.setAttribute(name,value);
    if(content!=null)e.textContent=content;
    return e;
  }
  const paymentBase=routes['mi-negocio-pagos'];
  if(paymentBase)routes['mi-negocio-pagos']=async function(bid){
    const result=await paymentBase.apply(this,arguments);
    const target=document.querySelector('.dy-direct-pay-settings');
    if(!target||!ME||ME.account_type!=='business')return result;
    const section=el('section',{class:'dy-business-card dy-payku-card'});
    target.before(section);
    section.innerHTML='<div class="dy-card-head"><div><span>PAGOS ONLINE</span><h2>💳 Cobrar con Payku</h2><p>Una sola activación. Tus clientes pagan online y el proveedor distribuye los fondos al negocio.</p></div></div>'+
      '<p class="dy-payku-muted">Revisando disponibilidad…</p>';
    try{
      const [state,meta]=await Promise.all([
        api('/businesses/'+Number(bid)+'/payku'),
        api('/businesses/'+Number(bid)+'/manage')
      ]);
      const p=state.payku||{},business=meta.business||{};
      if(p.connected){
        section.innerHTML='<div class="dy-card-head"><div><span>PAGOS ONLINE</span><h2>✅ Payku conectado</h2><p>Tu negocio puede recibir pagos online, sujeto a las condiciones del proveedor.</p></div></div>'+
          '<p class="dy-payku-success">Cuenta terminada en '+safe(p.bank_last4||'—')+' · Comisión DatoYa: 0%</p>';
        return result;
      }
      if(!p.enabled){
        section.innerHTML='<div class="dy-card-head"><div><span>PRÓXIMAMENTE</span><h2>💳 Payku Marketplace</h2>'+
          '<p>Estamos preparando los cobros automáticos con tarjeta y transferencia.</p></div></div>'+
          '<div class="dy-payku-info">Por ahora puedes usar los métodos de pago directo de abajo. No necesitas crear una cuenta Payku ni agregar claves.</div>';
        return result;
      }
      const partial=p.status==='client_registered';
      section.innerHTML='<div class="dy-card-head"><div><span>PAGOS ONLINE</span><h2>💳 Activar cobros Payku</h2>'+
        '<p>'+ (partial?'Ya registramos tus datos. Completa la vinculación.':'Ingresa tus datos una vez. No necesitas configurar ninguna clave API.') +'</p></div></div>'+
        '<form class="dy-payku-form" id="dy-payku-onboard">'+
        '<label>Nombre del titular<input name="name" required maxlength="150" value="'+safe(business.name||'')+'"></label>'+
        '<label>Correo<input name="email" type="email" required maxlength="50" value="'+safe(ME.email||'')+'"></label>'+
        '<label>Teléfono<input name="phone" type="tel" required maxlength="12" value="'+safe(String(business.phone||ME.phone||'').replace(/\D/g,'').slice(-12))+'"></label>'+
        '<label>Banco<select name="bank_code" required><option value="">Seleccionar banco</option></select></label>'+
        '<label>Tipo de cuenta<select name="bank_type" required>'+
          '<option value="2">Cuenta vista / Cuenta RUT</option><option value="1">Cuenta corriente</option><option value="3">Cuenta de ahorro</option></select></label>'+
        '<label>Número de cuenta<input name="bank_number" type="text" inputmode="numeric" required maxlength="40" autocomplete="off"></label>'+
        '<label>RUT del titular<input name="rut" type="text" required maxlength="12" autocomplete="off" placeholder="Sin puntos"></label>'+
        '<p class="dy-payku-muted">Estos datos se envían al proveedor para el registro. DatoYa conserva solo la terminación de la cuenta, no su número completo.</p>'+
        '<button type="submit" class="btn btn-primary btn-block">Activar cobros online</button></form>';
      const form=section.querySelector('#dy-payku-onboard');
      try{
        const data=await api('/payku/marketplace/banks');
        const banks=Array.isArray(data.banks)?data.banks:[];
        const select=form.elements.bank_code;
        banks.forEach(bank=>{
          if(!/^\d{3,5}$/.test(String(bank.code)))return;
          select.appendChild(el('option',{value:String(bank.code)},String(bank.name||bank.code)));
        });
        if(!banks.length)throw new Error('Banco no disponible');
      }catch(_){
        const select=form.elements.bank_code;select.replaceWith(el('input',{
          name:'bank_code',placeholder:'Código de banco (Payku)',required:'',maxlength:'5',inputmode:'numeric'
        }));
        section.appendChild(el('p',{class:'dy-payku-muted'},'No se pudo cargar la lista de bancos. Puedes reintentar más tarde.'));
      }
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        const btn=form.querySelector('[type=submit]');btn.disabled=true;btn.textContent='Conectando…';
        const f=new FormData(form);
        try{
          const data={
            name:String(f.get('name')||''),email:String(f.get('email')||''),phone:String(f.get('phone')||''),
            bank:{sbif:String(f.get('bank_code')||''),type:String(f.get('bank_type')||''),
              num:String(f.get('bank_number')||''),rut:String(f.get('rut')||'')}
          };
          await api('/businesses/'+Number(bid)+'/payku/onboard',{method:'POST',body:data});
          toast?.('Payku vinculado al negocio','ok');
          routes['mi-negocio-pagos'](bid);
        }catch(e){btn.disabled=false;btn.textContent='Activar cobros online';toast?.(e.message||'No se pudo activar Payku','err');}
      });
    }catch(err){
      section.innerHTML='<div class="dy-payku-info">No se pudo revisar Payku. Puedes seguir usando las otras formas de pago.</div>';
    }
    return result;
  };
  const customerBase=routes.pedidos;
  if(customerBase)routes.pedidos=async function(){
    const result=await customerBase.apply(this,arguments);
    if(!ME||ME.account_type!=='customer')return result;
    try{
      const {orders=[]}=await api('/orders/mine');
      for(const order of orders){
        if(order.status==='cancelled'||order.payment_status==='paid')continue;
        const card=document.getElementById('dy-order-'+Number(order.id));if(!card)continue;
        const state=await api('/orders/'+Number(order.id)+'/payku/status').catch(()=>null);
        if(!state||!state.available||state.paid)continue;
        const host=card.querySelector('.dy-direct-customer-actions')||card;
        if(host.querySelector('.dy-order-payku'))continue;
        const b=el('button',{type:'button',class:'btn btn-primary btn-sm dy-order-payku'},'💳 Pagar online con Payku');
        b.addEventListener('click',async()=>{
          if(b.disabled)return;b.disabled=true;b.textContent='Abriendo pago seguro…';
          try{
            const data=await api('/orders/'+Number(order.id)+'/payku/checkout',{method:'POST'});
            if(!data.payment_url)throw new Error('No recibimos el enlace de pago');
            const dest=new URL(data.payment_url);
            if(dest.protocol!=='https:'||!dest.hostname.endsWith('.payku.cl'))throw new Error('Enlace de pago inválido');
            location.href=dest.toString();
          }catch(e){b.disabled=false;b.textContent='💳 Pagar online con Payku';toast?.(e.message||'No se pudo iniciar el pago','err');}
        });
        host.prepend(b);
      }
    }catch(_){}
    return result;
  };
})();
